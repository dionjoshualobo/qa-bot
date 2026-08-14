/**
 * Pending question database queries
 */

import { getDatabase } from '../database.js';
import type { PendingQuestion, PendingQuestionInsert, Result } from '../../types/index.js';
import { ok, err } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export function createPending(data: PendingQuestionInsert): Result<PendingQuestion, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO pending_questions (asker_whatsapp_id, text, image_buffer, preview_message_id, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);

    const info = stmt.run(
      data.asker_whatsapp_id,
      data.text,
      data.image_buffer ?? null,
      data.preview_message_id,
    );

    const row = db
      .prepare('SELECT * FROM pending_questions WHERE id = ?')
      .get(info.lastInsertRowid) as any;
    return ok(row as PendingQuestion);
  } catch (error) {
    logger.db.error('Failed to create pending question', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getPendingByPreviewId(
  previewMessageId: string,
): Result<PendingQuestion | null, Error> {
  try {
    const db = getDatabase();
    const row = db
      .prepare('SELECT * FROM pending_questions WHERE preview_message_id = ?')
      .get(previewMessageId) as any;
    return ok(row ?? null);
  } catch (error) {
    logger.db.error('Failed to get pending question by preview message id', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Get pending question by asker WhatsApp ID (fallback for when message ID lookup fails)
 * Returns the most recent pending question from this asker
 */
export function getPendingByAsker(askerWhatsappId: string): Result<PendingQuestion | null, Error> {
  try {
    const db = getDatabase();
    const row = db
      .prepare(
        "SELECT * FROM pending_questions WHERE asker_whatsapp_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
      )
      .get(askerWhatsappId) as any;
    return ok(row ?? null);
  } catch (error) {
    logger.db.error('Failed to get pending question by asker', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Get the latest pending question (any asker). Used as fallback when no quoted msg id.
 */
export function getLatestPending(): Result<PendingQuestion | null, Error> {
  try {
    const db = getDatabase();
    const row = db
      .prepare("SELECT * FROM pending_questions WHERE status = 'pending' ORDER BY id DESC LIMIT 1")
      .get() as any;
    return ok(row ?? null);
  } catch (error) {
    logger.db.error('Failed to get latest pending question', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function markPendingPosted(id: number): Result<PendingQuestion, Error> {
  try {
    const db = getDatabase();
    db.prepare(`UPDATE pending_questions SET status = 'posted' WHERE id = ?`).run(id);
    const row = db.prepare('SELECT * FROM pending_questions WHERE id = ?').get(id) as any;
    return ok(row as PendingQuestion);
  } catch (error) {
    logger.db.error('Failed to mark pending question as posted', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function markPendingRejected(id: number): Result<PendingQuestion, Error> {
  try {
    const db = getDatabase();
    db.prepare(`UPDATE pending_questions SET status = 'rejected' WHERE id = ?`).run(id);
    const row = db.prepare('SELECT * FROM pending_questions WHERE id = ?').get(id) as any;
    return ok(row as PendingQuestion);
  } catch (error) {
    logger.db.error('Failed to mark pending question as rejected', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
