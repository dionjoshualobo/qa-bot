/**
 * Mapping service
 * Business logic for message mapping resolution
 */

import { getMappingByWhatsAppMessageId } from '../database/queries/mappings.js';
import { getQuestionById } from '../database/queries/questions.js';
import { getReplyById } from '../database/queries/replies.js';
import type { Question, Reply, Result } from '../types/index.js';
import { ok, err } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface ResolvedMapping {
  type: 'question' | 'reply';
  question: Question;
  reply?: Reply;
}

export async function resolveMessageMapping(
  whatsappMessageId: string,
): Promise<Result<ResolvedMapping | null, Error>> {
  logger.mapping.debug(`Resolving mapping for message: ${whatsappMessageId}`);

  const mappingResult = getMappingByWhatsAppMessageId(whatsappMessageId);
  if (!mappingResult.success) {
    return mappingResult;
  }

  if (!mappingResult.data) {
    logger.mapping.debug('No mapping found');
    return ok(null);
  }

  const mapping = mappingResult.data;

  // If it's a question mapping
  if (mapping.question_id !== null) {
    const questionResult = getQuestionById(mapping.question_id);
    if (!questionResult.success) {
      return questionResult;
    }

    logger.mapping.debug(`Resolved to question: ${questionResult.data.question_id}`);
    return ok({
      type: 'question',
      question: questionResult.data,
    });
  }

  // If it's a reply mapping
  if (mapping.reply_id !== null) {
    const replyResult = getReplyById(mapping.reply_id);
    if (!replyResult.success) {
      return replyResult;
    }

    const questionResult = getQuestionById(replyResult.data.question_id);
    if (!questionResult.success) {
      return questionResult;
    }

    logger.mapping.debug(`Resolved to reply: ${replyResult.data.reply_id}`);
    return ok({
      type: 'reply',
      question: questionResult.data,
      reply: replyResult.data,
    });
  }

  logger.mapping.error('Invalid mapping: neither question_id nor reply_id is set');
  return err(new Error('Invalid mapping state'));
}
