/**
 * Question service
 * Business logic for question management
 */

import {
  createQuestion,
  getQuestionByGroupMessageId,
  getNextQuestionNumber,
} from '../database/queries/questions.js';
import { createMapping } from '../database/queries/mappings.js';
import { ensureUser } from './users.js';
import type { Question, Result } from '../types/index.js';
import { ok, err } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { QUESTION_ID_PREFIX } from '../constants/messages.js';

export function generateQuestionId(questionNumber: number): string {
  return `${QUESTION_ID_PREFIX}${questionNumber}`;
}

export async function createNewQuestion(
  authorWhatsappId: string,
  text: string,
  groupMessageId: string,
  preGeneratedQuestionId?: string
): Promise<Result<Question, Error>> {
  logger.question.info(`Creating new question from ${authorWhatsappId}`);

  // Ensure user exists
  const userResult = ensureUser(authorWhatsappId);
  if (!userResult.success) {
    return userResult;
  }

  // Use pre-generated ID or generate new one
  let questionId: string;
  if (preGeneratedQuestionId) {
    questionId = preGeneratedQuestionId;
  } else {
    const questionNumberResult = getNextQuestionNumber();
    if (!questionNumberResult.success) {
      return questionNumberResult;
    }
    questionId = generateQuestionId(questionNumberResult.data);
  }

  // Create question
  const questionResult = createQuestion({
    question_id: questionId,
    author_whatsapp_id: authorWhatsappId,
    text,
    group_message_id: groupMessageId,
  });

  if (!questionResult.success) {
    return questionResult;
  }

  // Create mapping
  const mappingResult = createMapping({
    whatsapp_message_id: groupMessageId,
    question_id: questionResult.data.id,
    reply_id: null,
  });

  if (!mappingResult.success) {
    logger.question.error('Failed to create mapping for question', mappingResult.error);
    return err(mappingResult.error);
  }

  logger.question.info(`Created question ${questionId}`);
  return ok(questionResult.data);
}

export function findQuestionByGroupMessage(groupMessageId: string): Result<Question | null, Error> {
  return getQuestionByGroupMessageId(groupMessageId);
}
