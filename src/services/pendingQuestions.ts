/**
 * Pending question service
 * Business logic for pending question management
 */

import {
  createPending,
  getPendingByPreviewId,
  markPendingPosted,
  markPendingRejected,
} from '../database/queries/pendingQuestions.js';
import { ensureUser } from './users.js';
import type { PendingQuestion, Result } from '../types/index.js';
import { logger } from '../utils/logger.js';

export async function createPendingQuestion(
  askerWhatsappId: string,
  text: string,
  imageBuffer: Buffer | null,
  previewMessageId: string,
): Promise<Result<PendingQuestion, Error>> {
  logger.question.info(`Creating pending question from ${askerWhatsappId}`);

  // Ensure user exists
  const userResult = ensureUser(askerWhatsappId);
  if (!userResult.success) {
    return userResult;
  }

  return createPending({
    asker_whatsapp_id: askerWhatsappId,
    text,
    image_buffer: imageBuffer,
    preview_message_id: previewMessageId,
  });
}

export function getPendingByPreview(
  previewMessageId: string,
): Result<PendingQuestion | null, Error> {
  return getPendingByPreviewId(previewMessageId);
}

export function markPosted(pendingId: number): Result<PendingQuestion, Error> {
  return markPendingPosted(pendingId);
}

export function markRejected(pendingId: number): Result<PendingQuestion, Error> {
  return markPendingRejected(pendingId);
}