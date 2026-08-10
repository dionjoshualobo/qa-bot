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

import { createNewReply, generateReplyId, findReplyByGroupMessage } from './replies.js';
import { createQuestion } from '../database/queries/questions.js';
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
  return id;
}

describe('generateReplyId', () => {
  it('generates direct reply ID', () => {
    const question = { id: 1, question_id: 'Q1', author_whatsapp_id: '', text: '', group_message_id: '', created_at: '' };
    const id = generateReplyId(question, null, 1);
    expect(id).toBe('Q1.1');
  });

  it('generates nested reply ID', () => {
    const question = { id: 1, question_id: 'Q1', author_whatsapp_id: '', text: '', group_message_id: '', created_at: '' };
    const parent = { id: 1, reply_id: 'Q1.1', question_id: 1, parent_reply_id: null, group_message_id: '', author_whatsapp_id: '', text: '', created_at: '' };
    const id = generateReplyId(question, parent, 2);
    expect(id).toBe('Q1.1.2');
  });
});

describe('createNewReply', () => {
  it('creates a reply to a question', async () => {
    insertTestQuestion();

    const result = await createNewReply(
      '222@s.whatsapp.net',
      'Great question!',
      'msg_r1',
      1,
      null,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reply_id).toBe('Q1.1');
      expect(result.data.text).toBe('Great question!');
    }
  });

  it('creates nested replies', async () => {
    insertTestQuestion();

    await createNewReply('222@s.whatsapp.net', 'Reply 1', 'msg_r1', 1, null);
    const nested = await createNewReply('333@s.whatsapp.net', 'Reply 2', 'msg_r2', 1, 1);

    expect(nested.success).toBe(true);
    if (nested.success) {
      expect(nested.data.reply_id).toBe('Q1.1.1');
    }
  });
});

describe('findReplyByGroupMessage', () => {
  it('finds reply by group message ID', async () => {
    insertTestQuestion();
    await createNewReply('222@s.whatsapp.net', 'Test reply', 'msg_r1', 1, null);

    const result = findReplyByGroupMessage('msg_r1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data?.text).toBe('Test reply');
    }
  });

  it('returns null for unknown message', () => {
    const result = findReplyByGroupMessage('unknown');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });
});
