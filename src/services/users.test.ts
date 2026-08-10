import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../test/helpers.js';
import type Database from 'better-sqlite3';

vi.mock('../database/database.js', () => {
  let testDb: Database.Database;
  return {
    getDatabase: () => testDb,
    __setTestDb: (db: Database.Database) => {
      testDb = db;
    },
  };
});

import { ensureUser } from './users.js';
import { __setTestDb } from '../database/database.js';

let db: Database.Database;

beforeEach(async () => {
  db = createTestDb();
  __setTestDb(db);
});

describe('ensureUser', () => {
  it('creates a new user', () => {
    const result = ensureUser('12345@s.whatsapp.net');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.whatsapp_id).toBe('12345@s.whatsapp.net');
    }
  });

  it('returns existing user', () => {
    ensureUser('12345@s.whatsapp.net');
    const result = ensureUser('12345@s.whatsapp.net');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.whatsapp_id).toBe('12345@s.whatsapp.net');
    }
  });

  it('creates separate users for different IDs', () => {
    ensureUser('111@s.whatsapp.net');
    ensureUser('222@s.whatsapp.net');

    const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    expect(count.count).toBe(2);
  });
});
