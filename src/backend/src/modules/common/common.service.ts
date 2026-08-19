import { prisma } from '../../utils/db.js';
import { SYSTEM_SETTINGS, USER_SETTINGS } from './settings.config.js';
import { dragonfly } from '../../utils/dragonfly.js';

export async function getGlobalSetting(key: string): Promise<string> {
  const cached = await dragonfly.get(`settings:global:${key}`);
  if (cached) return cached;
  
  const setting = await prisma.baseinventreesetting.findFirst({ where: { key } });
  if (setting) {
    await dragonfly.set(`settings:global:${key}`, setting.value, 'EX', 3600);
    return setting.value;
  }
  
  // Fallback to default
  const def = SYSTEM_SETTINGS[key]?.default;
  return def !== undefined ? String(def) : '';
}

export async function setGlobalSetting(key: string, value: string): Promise<void> {
  // Validate based on SYSTEM_SETTINGS
  const config = SYSTEM_SETTINGS[key];
  if (config) {
    if (config.type === 'boolean') {
      value = (value === 'true' || value === '1' || value === 'True') ? 'True' : 'False';
    } else if (config.type === 'number') {
      if (isNaN(Number(value))) throw new Error(`Setting ${key} requires a numeric value`);
    }
  }

  const existing = await prisma.baseinventreesetting.findFirst({ where: { key } });
  if (existing) {
    await prisma.baseinventreesetting.update({ where: { id: existing.id }, data: { value } });
  } else {
    await prisma.baseinventreesetting.create({ data: { key, value } });
  }
  
  // Clear cache
  await dragonfly.del(`settings:global:${key}`);
  await dragonfly.del('settings:global');
}

export async function getUserSetting(key: string, userId: number): Promise<string> {
  const setting = await prisma.inventreeusersetting.findFirst({ where: { key, userId } });
  if (setting) return setting.value;
  
  const def = USER_SETTINGS[key]?.default;
  return def !== undefined ? String(def) : '';
}

export async function setUserSetting(key: string, value: string, userId: number): Promise<void> {
  const config = USER_SETTINGS[key];
  if (config) {
    if (config.type === 'boolean') {
      value = (value === 'true' || value === '1' || value === 'True') ? 'True' : 'False';
    } else if (config.type === 'number') {
      if (isNaN(Number(value))) throw new Error(`Setting ${key} requires a numeric value`);
    }
  }

  const existing = await prisma.inventreeusersetting.findFirst({ where: { key, userId } });
  if (existing) {
    await prisma.inventreeusersetting.update({ where: { id: existing.id }, data: { value } });
  } else {
    await prisma.inventreeusersetting.create({ data: { key, value, userId } });
  }
}
