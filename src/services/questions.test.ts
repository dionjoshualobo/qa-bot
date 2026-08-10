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

import { createNewQuestion, generateQuestionId, findQuestionByGroupMessage } from './questions.js';
import { __setTestDb } from '../database/database.js';

let db: Database.Database;

beforeEach(async () => {
  db = createTestDb();
  __setTestDb(db);
});

describe('generateQuestionId', () => {
  it('generates Q + number', () => {
    expect(generateQuestionId(1)).toBe('Q1');
    expect(generateQuestionId(42)).toBe('Q42');
  });
});

describe('createNewQuestion', () => {
  it('creates a question with auto-generated ID', async () => {
    const result = await createNewQuestion('12345@s.whatsapp.net', 'What is love?', 'msg_001');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.question_id).toBe('Q1');
      expect(result.data.text).toBe('What is love?');
    }
  });

  it('increments question numbers', async () => {
    await createNewQuestion('111@s.whatsapp.net', 'Q1', 'msg_001');
    const second = await createNewQuestion('222@s.whatsapp.net', 'Q2', 'msg_002');

    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.data.question_id).toBe('Q2');
    }
  });

  it('uses pre-generated ID when provided', async () => {
    const result = await createNewQuestion('12345@s.whatsapp.net', 'Test', 'msg_001', 'Q99');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.question_id).toBe('Q99');
    }
  });
});

describe('findQuestionByGroupMessage', () => {
  it('finds question by group message ID', async () => {
    await createNewQuestion('12345@s.whatsapp.net', 'Test', 'msg_001');
    const result = findQuestionByGroupMessage('msg_001');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data?.text).toBe('Test');
    }
  });

  it('returns null for unknown message', () => {
    const result = findQuestionByGroupMessage('unknown');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });
});
