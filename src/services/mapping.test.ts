import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, insertTestUser } from '../test/helpers.js';
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

import { resolveMessageMapping } from './mapping.js';
import { createMapping } from '../database/queries/mappings.js';
import { __setTestDb } from '../database/database.js';

let db: Database.Database;

beforeEach(async () => {
  db = createTestDb();
  __setTestDb(db);
});

function insertTestQuestion(id = 1, questionId = 'Q1') {
  insertTestUser(db, '111@s.whatsapp.net');
  db.prepare(
    'INSERT INTO questions (id, question_id, author_whatsapp_id, text, group_message_id) VALUES (?, ?, ?, ?, ?)',
  ).run(id, questionId, '111@s.whatsapp.net', 'Test question', 'msg_q1');
}

function insertTestReply(id = 1, replyId = 'Q1.1', questionId = 1) {
  insertTestUser(db, '222@s.whatsapp.net');
  db.prepare(
    'INSERT INTO replies (id, reply_id, question_id, parent_reply_id, group_message_id, author_whatsapp_id, text) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, replyId, questionId, null, 'msg_r1', '222@s.whatsapp.net', 'Test reply');
}

describe('resolveMessageMapping', () => {
  it('resolves question mapping', async () => {
    insertTestQuestion();
    createMapping({ whatsapp_message_id: 'wa_q1', question_id: 1, reply_id: null });

    const result = await resolveMessageMapping('wa_q1');
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.type).toBe('question');
      expect(result.data.question.question_id).toBe('Q1');
    }
  });

  it('resolves reply mapping', async () => {
    insertTestQuestion();
    insertTestReply();
    createMapping({ whatsapp_message_id: 'wa_r1', question_id: null, reply_id: 1 });

    const result = await resolveMessageMapping('wa_r1');
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.type).toBe('reply');
      expect(result.data.reply?.reply_id).toBe('Q1.1');
      expect(result.data.question.question_id).toBe('Q1');
    }
  });

  it('returns null for unknown message', async () => {
    const result = await resolveMessageMapping('unknown');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });
});
