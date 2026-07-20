/**
 * Private chat message handler
 * Handles messages sent directly to the bot
 */

import type { Message } from 'whatsapp-web.js';
import { getClient } from '../client.js';
import { createNewQuestion } from '../../services/questions.js';
import { logger } from '../../utils/logger.js';
import { MESSAGES } from '../../constants/messages.js';
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

  logger.bot.info(`Received private message from ${authorId}`);

  try {
    const client = getClient();
    const groupChat = await client.getChatById(config.bot.groupId);

    // Post question to group
    const groupMessage = await groupChat.sendMessage(
      MESSAGES.QUESTION_TEMPLATE('...', text)
    );

    // Create question in database
    const questionResult = await createNewQuestion(
      authorId,
      text,
      groupMessage.id._serialized
    );

    if (!questionResult.success) {
      logger.bot.error('Failed to create question', questionResult.error);
      await message.reply(MESSAGES.ERROR_GENERIC);
      return;
    }

    // Update the group message with the actual question ID
    await groupMessage.edit(
      MESSAGES.QUESTION_TEMPLATE(questionResult.data.question_id, text)
    );

    // Confirm to user
    await message.reply(MESSAGES.SUCCESS_QUESTION_POSTED(questionResult.data.question_id));

    logger.bot.info(`Posted question ${questionResult.data.question_id} to group`);
  } catch (error) {
    logger.bot.error('Error handling private message', error);
    await message.reply(MESSAGES.ERROR_GENERIC);
  }
}
