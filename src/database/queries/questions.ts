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
      data.group_message_id
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

export function getQuestionByGroupMessageId(groupMessageId: string): Result<Question | null, Error> {
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
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM questions
    `);
    
    const result = stmt.get() as { count: number } | undefined;
    
    return ok((result?.count ?? 0) + 1);
  } catch (error) {
    logger.db.error('Failed to get next question number', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
