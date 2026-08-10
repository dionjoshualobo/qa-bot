/**
 * Reply database queries
 */

import { getDatabase } from '../database.js';
import type { Reply, ReplyInsert, Result } from '../../types/index.js';
import { ok, err } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export function createReply(data: ReplyInsert): Result<Reply, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO replies (reply_id, question_id, parent_reply_id, group_message_id, author_whatsapp_id, text)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      data.reply_id,
      data.question_id,
      data.parent_reply_id,
      data.group_message_id,
      data.author_whatsapp_id,
      data.text,
    );

    const reply = getReplyById(Number(info.lastInsertRowid));
    if (!reply.success) {
      return reply;
    }

    logger.db.debug(`Created reply: ${data.reply_id}`);
    return ok(reply.data);
  } catch (error) {
    logger.db.error('Failed to create reply', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getReplyById(id: number): Result<Reply, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM replies WHERE id = ?
    `);

    const reply = stmt.get(id) as Reply | undefined;

    if (!reply) {
      return err(new Error(`Reply not found: ${id}`));
    }

    return ok(reply);
  } catch (error) {
    logger.db.error('Failed to get reply by id', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getReplyByGroupMessageId(groupMessageId: string): Result<Reply | null, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM replies WHERE group_message_id = ?
    `);

    const reply = stmt.get(groupMessageId) as Reply | undefined;

    return ok(reply ?? null);
  } catch (error) {
    logger.db.error('Failed to get reply by group message id', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getRepliesByQuestionId(questionId: number): Result<Reply[], Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM replies WHERE question_id = ? ORDER BY created_at ASC
    `);

    const replies = stmt.all(questionId) as Reply[];

    return ok(replies);
  } catch (error) {
    logger.db.error('Failed to get replies by question id', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getNextReplyNumber(
  questionId: number,
  parentReplyId: number | null,
): Result<number, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM replies 
      WHERE question_id = ? AND parent_reply_id ${parentReplyId === null ? 'IS NULL' : '= ?'}
    `);

    const result =
      parentReplyId === null
        ? (stmt.get(questionId) as { count: number } | undefined)
        : (stmt.get(questionId, parentReplyId) as { count: number } | undefined);

    return ok((result?.count ?? 0) + 1);
  } catch (error) {
    logger.db.error('Failed to get next reply number', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
