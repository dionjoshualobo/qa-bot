/**
 * Group chat message handler
 * Handles replies to questions in the group
 */

import type { Message } from 'whatsapp-web.js';
import { getClient } from '../client.js';
import { resolveMessageMapping } from '../../services/mapping.js';
import { createNewReply } from '../../services/replies.js';
import { logger } from '../../utils/logger.js';
import { MESSAGES } from '../../constants/messages.js';
import type { Config } from '../../types/index.js';

export async function handleGroupMessage(
  message: Message,
  _config: Config
): Promise<void> {
  // Only process replies
  if (!message.hasQuotedMsg) {
    logger.bot.debug('Ignoring non-reply message in group');
    return;
  }

  const text = message.body.trim();
  const authorId = message.author ?? message.from;

  if (!text) {
    logger.bot.debug('Ignoring empty reply');
    return;
  }

  logger.bot.info(`Received group reply from ${authorId}`);

  try {
    const quotedMsg = await message.getQuotedMessage();
    const quotedMsgId = quotedMsg.id._serialized;

    // Resolve what the user is replying to
    const mappingResult = await resolveMessageMapping(quotedMsgId);

    if (!mappingResult.success) {
      logger.bot.error('Failed to resolve mapping', mappingResult.error);
      await message.reply(MESSAGES.ERROR_GENERIC);
      return;
    }

    if (!mappingResult.data) {
      logger.bot.debug('Reply is not to a tracked message');
      return;
    }

    const resolved = mappingResult.data;
    const question = resolved.question;
    const parentReply = resolved.reply ?? null;

    // Create reply in database
    const replyResult = await createNewReply(
      authorId,
      text,
      message.id._serialized,
      question.id,
      parentReply?.id ?? null
    );

    if (!replyResult.success) {
      logger.bot.error('Failed to create reply', replyResult.error);
      await message.reply(MESSAGES.ERROR_GENERIC);
      return;
    }

    // Get sender name
    const contact = await message.getContact();
    const senderName = contact.pushname || contact.name || 'Anonymous';

    // Forward reply to original question asker
    const client = getClient();
    const askerChat = await client.getChatById(question.author_whatsapp_id);

    const replyMessage = MESSAGES.REPLY_TO_ASKER(
      question.question_id,
      replyResult.data.reply_id,
      senderName,
      text
    );

    await askerChat.sendMessage(replyMessage);

    logger.bot.info(
      `Forwarded reply ${replyResult.data.reply_id} to question asker`
    );
  } catch (error) {
    logger.bot.error('Error handling group message', error);
    await message.reply(MESSAGES.ERROR_GENERIC);
  }
}
