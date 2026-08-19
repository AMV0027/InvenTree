import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Dragonfly is Redis-compatible, so standard ioredis client works out of the box
export const dragonfly = new Redis(redisUrl);

dragonfly.on('connect', () => {
  console.log('Successfully connected to Dragonfly (Redis-compatible) cache');
});

dragonfly.on('error', (err: any) => {
  console.error('Dragonfly connection error:', err);
});
