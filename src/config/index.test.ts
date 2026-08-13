import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig } from './index.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('loads config from env vars', () => {
    process.env.SESSION_PATH = '/tmp/session';
    process.env.DATABASE_PATH = '/tmp/test.db';
    process.env.GROUP_ID = '12345@g.us';
    process.env.OWNER_WHATSAPP_ID = 'owner123@s.whatsapp.net';
    process.env.LOG_LEVEL = 'debug';

    const config = loadConfig();
    expect(config.whatsapp.sessionPath).toBe('/tmp/session');
    expect(config.database.path).toBe('/tmp/test.db');
    expect(config.bot.groupId).toBe('12345@g.us');
    expect(config.logging.level).toBe('debug');
  });

  it('uses defaults when optional vars missing', () => {
    delete process.env.SESSION_PATH;
    delete process.env.DATABASE_PATH;
    delete process.env.LOG_LEVEL;
    process.env.GROUP_ID = '12345@g.us';
    process.env.OWNER_WHATSAPP_ID = 'owner123@s.whatsapp.net';

    const config = loadConfig();
    expect(config.whatsapp.sessionPath).toBe('./.baileys_auth');
    expect(config.database.path).toBe('./qa-bot.db');
    expect(config.logging.level).toBe('info');
  });

  it('throws when GROUP_ID missing', () => {
    delete process.env.GROUP_ID;
    delete process.env.OWNER_WHATSAPP_ID;
    expect(() => loadConfig()).toThrow('GROUP_ID');
  });

  it('falls back to info for invalid log level', () => {
    process.env.GROUP_ID = '12345@g.us';
    process.env.OWNER_WHATSAPP_ID = 'owner123@s.whatsapp.net';
    process.env.LOG_LEVEL = 'invalid';
    const config = loadConfig();
    expect(config.logging.level).toBe('info');
  });
});
