const fs = require('fs');

function parseSettings(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const settings = {};
  
  // A crude regex to capture keys in the SYSTEM_SETTINGS dict
  const regex = /'([A-Z0-Z_]+)'\s*:\s*\{([^}]*)\}/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const block = match[2];
    
    // Very basic extraction of properties
    const getType = () => {
      if (block.includes("'validator': bool")) return 'boolean';
      if (block.includes("'validator': int")) return 'number';
      return 'string';
    };
    
    const getDefault = () => {
      const defMatch = block.match(/'default':\s*([^,\n]*)/);
      if (defMatch) {
        let val = defMatch[1].trim();
        if (val === 'False') return false;
        if (val === 'True') return true;
        if (val.startsWith("'") || val.startsWith('"')) return val.replace(/['"]/g, '');
        return val;
      }
      return '';
    };

    settings[key] = {
      type: getType(),
      default: getDefault()
    };
  }
  
  return settings;
}

const sysSettings = parseSettings('src/backend_backup/InvenTree/common/setting/system.py');
const usrSettings = parseSettings('src/backend_backup/InvenTree/common/setting/user.py');

const tsFile = `// Auto-generated settings definition
export const SYSTEM_SETTINGS: Record<string, { type: 'string' | 'number' | 'boolean', default: any }> = ${JSON.stringify(sysSettings, null, 2)};
export const USER_SETTINGS: Record<string, { type: 'string' | 'number' | 'boolean', default: any }> = ${JSON.stringify(usrSettings, null, 2)};
`;

fs.writeFileSync('src/backend/src/modules/common/settings.config.ts', tsFile);
console.log('Generated settings.config.ts');
