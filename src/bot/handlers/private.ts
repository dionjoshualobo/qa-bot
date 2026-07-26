/**
 * Private chat message handler
 */

import type { WASocket } from '@whiskeysockets/baileys';
import { createNewQuestion } from '../../services/questions.js';
import { logger } from '../../utils/logger.js';
import { MESSAGES } from '../../constants/messages.js';
import type { Config } from '../../types/index.js';

export async function handlePrivateMessage(
  sock: WASocket,
  message: any,
  text: string,
  config: Config
): Promise<void> {
  const authorId = message.key.remoteJid!;

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
    const groupId = config.bot.groupId;

    // Post question to group
    const sent = await sock.sendMessage(groupId, { text: MESSAGES.QUESTION_TEMPLATE('...', questionText) });
    const groupMsgId = sent?.key?.id ?? '';

    // Create question in database
    const questionResult = await createNewQuestion(authorId, questionText, groupMsgId);

    if (!questionResult.success) {
      logger.bot.error('Failed to create question', questionResult.error);
      await sock.sendMessage(authorId, { text: MESSAGES.ERROR_GENERIC });
      return;
    }

    // Update the group message with the actual question ID
    if (sent?.key) {
      await sock.sendMessage(groupId, {
        text: MESSAGES.QUESTION_TEMPLATE(questionResult.data.question_id, questionText),
        edit: sent.key,
      });
    }

    // Confirm to user
    await sock.sendMessage(authorId, {
      text: MESSAGES.SUCCESS_QUESTION_POSTED(questionResult.data.question_id),
    });

    logger.bot.info(`Posted question ${questionResult.data.question_id} to group`);
  } catch (error) {
    logger.bot.error('Error handling private message', error);
    await sock.sendMessage(message.key.remoteJid!, { text: MESSAGES.ERROR_GENERIC });
  }
}
