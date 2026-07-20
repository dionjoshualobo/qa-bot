/**
 * Reply service
 * Business logic for reply management
 */

import {
  createReply,
  getReplyByGroupMessageId,
  getNextReplyNumber,
} from '../database/queries/replies.js';
import { getQuestionById } from '../database/queries/questions.js';
import { createMapping } from '../database/queries/mappings.js';
import { ensureUser } from './users.js';
import type { Reply, Question, Result } from '../types/index.js';
import { ok, err } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { REPLY_ID_SEPARATOR } from '../constants/messages.js';

export function generateReplyId(
  question: Question,
  parentReply: Reply | null,
  replyNumber: number
): string {
  if (parentReply === null) {
    // Direct reply to question
    return `${question.question_id}${REPLY_ID_SEPARATOR}${replyNumber}`;
  }

  // Reply to another reply
  return `${parentReply.reply_id}${REPLY_ID_SEPARATOR}${replyNumber}`;
}

export async function createNewReply(
  authorWhatsappId: string,
  text: string,
  groupMessageId: string,
  questionId: number,
  parentReplyId: number | null
): Promise<Result<Reply, Error>> {
  logger.reply.info(`Creating new reply from ${authorWhatsappId}`);

  // Ensure user exists
  const userResult = ensureUser(authorWhatsappId);
  if (!userResult.success) {
    return userResult;
  }

  // Get question
  const questionResult = getQuestionById(questionId);
  if (!questionResult.success) {
    return questionResult;
  }

  // Get parent reply if exists
  let parentReply: Reply | null = null;
  if (parentReplyId !== null) {
    const parentReplyResult = await import('../database/queries/replies.js').then(m =>
      m.getReplyById(parentReplyId)
    );
    if (!parentReplyResult.success) {
      return parentReplyResult;
    }
    parentReply = parentReplyResult.data;
  }

  // Get next reply number
  const replyNumberResult = getNextReplyNumber(questionId, parentReplyId);
  if (!replyNumberResult.success) {
    return replyNumberResult;
  }

  const replyId = generateReplyId(
    questionResult.data,
    parentReply,
    replyNumberResult.data
  );

  // Create reply
  const replyResult = createReply({
    reply_id: replyId,
    question_id: questionId,
    parent_reply_id: parentReplyId,
    group_message_id: groupMessageId,
    author_whatsapp_id: authorWhatsappId,
    text,
  });

  if (!replyResult.success) {
    return replyResult;
  }

  // Create mapping
  const mappingResult = createMapping({
    whatsapp_message_id: groupMessageId,
    question_id: null,
    reply_id: replyResult.data.id,
  });

  if (!mappingResult.success) {
    logger.reply.error('Failed to create mapping for reply', mappingResult.error);
    return err(mappingResult.error);
  }

  logger.reply.info(`Created reply ${replyId}`);
  return ok(replyResult.data);
}

export function findReplyByGroupMessage(groupMessageId: string): Result<Reply | null, Error> {
  return getReplyByGroupMessageId(groupMessageId);
}
