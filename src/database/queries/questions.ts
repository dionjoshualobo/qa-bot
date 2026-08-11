/**
 * Question database queries
 */

import { getDatabase } from '../database.js';
import type { Question, QuestionInsert, Result } from '../../types/index.js';
import { ok, err } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export function createQuestion(data: QuestionInsert): Result<Question, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO questions (question_id, author_whatsapp_id, text, group_message_id)
      VALUES (?, ?, ?, ?)
    `);

    const info = stmt.run(
      data.question_id,
      data.author_whatsapp_id,
      data.text,
      data.group_message_id,
    );

    const question = getQuestionById(Number(info.lastInsertRowid));
    if (!question.success) {
      return question;
    }

    logger.db.debug(`Created question: ${data.question_id}`);
    return ok(question.data);
  } catch (error) {
    logger.db.error('Failed to create question', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getQuestionById(id: number): Result<Question, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM questions WHERE id = ?
    `);

    const question = stmt.get(id) as Question | undefined;

    if (!question) {
      return err(new Error(`Question not found: ${id}`));
    }

    return ok(question);
  } catch (error) {
    logger.db.error('Failed to get question by id', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getQuestionByQuestionId(questionId: string): Result<Question | null, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM questions WHERE question_id = ?
    `);

    const question = stmt.get(questionId) as Question | undefined;

    return ok(question ?? null);
  } catch (error) {
    logger.db.error('Failed to get question by question_id', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getQuestionByGroupMessageId(
  groupMessageId: string,
): Result<Question | null, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM questions WHERE group_message_id = ?
    `);

    const question = stmt.get(groupMessageId) as Question | undefined;

    return ok(question ?? null);
  } catch (error) {
    logger.db.error('Failed to get question by group message id', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getNextQuestionNumber(): Result<number, Error> {
  try {
    const db = getDatabase();
    const nextQuestionNumber = db.transaction(() => {
      db.prepare(
        `
        INSERT OR IGNORE INTO question_counters (name, value)
        SELECT 'questions', COALESCE(MAX(value), 0)
        FROM (
          SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'questions'), 0) AS value
          UNION ALL
          SELECT COALESCE(MAX(CAST(SUBSTR(question_id, 2) AS INTEGER)), 0) AS value
          FROM questions
          WHERE question_id GLOB 'Q[0-9]*'
        )
      `,
      ).run();

      db.prepare(
        `
        UPDATE question_counters
        SET value = value + 1
        WHERE name = 'questions'
      `,
      ).run();

      const result = db
        .prepare(
          `
        SELECT value FROM question_counters WHERE name = 'questions'
      `,
        )
        .get() as { value: number } | undefined;

      if (!result) {
        throw new Error('Question counter not initialized');
      }

      return result.value;
    })();

    return ok(nextQuestionNumber);
  } catch (error) {
    logger.db.error('Failed to get next question number', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function deleteUserData(authorWhatsappId: string): Result<void, Error> {
  try {
    const db = getDatabase();

    // Get all question IDs for this user
    const questions = db
      .prepare(
        `
      SELECT id FROM questions WHERE author_whatsapp_id = ?
    `,
      )
      .all(authorWhatsappId) as { id: number }[];

    if (questions.length === 0) {
      return ok(undefined);
    }

    const questionIds = questions.map((q) => q.id);
    const placeholders = questionIds.map(() => '?').join(',');

    // Delete mappings for questions
    db.prepare(
      `
      DELETE FROM message_mappings 
      WHERE question_id IN (SELECT id FROM questions WHERE author_whatsapp_id = ?)
    `,
    ).run(authorWhatsappId);

    // Delete mappings for replies to these questions
    db.prepare(
      `
      DELETE FROM message_mappings 
      WHERE reply_id IN (SELECT id FROM replies WHERE question_id IN (${placeholders}))
    `,
    ).run(...questionIds);

    // Delete replies to these questions
    db.prepare(
      `
      DELETE FROM replies WHERE question_id IN (${placeholders})
    `,
    ).run(...questionIds);

    // Delete mappings for replies this user authored
    db.prepare(
      `
      DELETE FROM message_mappings
      WHERE reply_id IN (SELECT id FROM replies WHERE author_whatsapp_id = ?)
    `,
    ).run(authorWhatsappId);

    // Delete replies this user authored (to other users' questions)
    db.prepare(
      `
      DELETE FROM replies WHERE author_whatsapp_id = ?
    `,
    ).run(authorWhatsappId);

    // Delete questions
    db.prepare(
      `
      DELETE FROM questions WHERE author_whatsapp_id = ?
    `,
    ).run(authorWhatsappId);

    // Delete user row (counter is in question_counters, unaffected)
    db.prepare(
      `
      DELETE FROM users WHERE whatsapp_id = ?
    `,
    ).run(authorWhatsappId);

    logger.db.debug(`Deleted data for user: ${authorWhatsappId}`);
    return ok(undefined);
  } catch (error) {
    logger.db.error('Failed to delete user data', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
