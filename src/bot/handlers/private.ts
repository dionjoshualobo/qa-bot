/**
 * Private chat message handler
 * Handles messages sent directly to the bot
 */

import type { Message } from 'whatsapp-web.js';
import { createNewQuestion } from '../../services/questions.js';
import { logger } from '../../utils/logger.js';
import { MESSAGES } from '../../constants/messages.js';
import { waSendText, waEditMessage } from '../wa-bridge.js';
import type { Config } from '../../types/index.js';

export async function handlePrivateMessage(
  message: Message,
  config: Config
): Promise<void> {
  const text = message.body.trim();
  const authorId = message.from;

  if (!text) {
    logger.bot.debug('Ignoring empty message');
    return;
  }

  // Only process /q or /question commands
  const match = text.match(/^\/(?:q|question)\s+(.*)/i);
  if (!match || !match[1]) {
    logger.bot.debug('Ignoring non-command message');
    return;
  }

  const questionText = match[1].trim();
  if (!questionText) {
    logger.bot.debug('Ignoring empty question');
    return;
  }

  logger.bot.info(`Received private message from ${authorId}`);

  try {
    const groupId = config.bot.groupId!;

    // Post question to group
    const groupMsgId = await waSendText(groupId, MESSAGES.QUESTION_TEMPLATE('...', questionText));

    // Create question in database
    const questionResult = await createNewQuestion(authorId, questionText, groupMsgId);

    if (!questionResult.success) {
      logger.bot.error('Failed to create question', questionResult.error);
      await waSendText(authorId, MESSAGES.ERROR_GENERIC);
      return;
    }

    // Update the group message with the actual question ID
    await waEditMessage(groupMsgId, MESSAGES.QUESTION_TEMPLATE(questionResult.data.question_id, questionText));

    // Confirm to user
    await waSendText(authorId, MESSAGES.SUCCESS_QUESTION_POSTED(questionResult.data.question_id));

    logger.bot.info(`Posted question ${questionResult.data.question_id} to group`);
  } catch (error) {
    logger.bot.error('Error handling private message', error);
    await waSendText(authorId, MESSAGES.ERROR_GENERIC);
  }
}
