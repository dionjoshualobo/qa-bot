/**
 * Group chat message handler
 * Handles replies to questions in the group
 */

import type { Message } from 'whatsapp-web.js';
import { resolveMessageMapping } from '../../services/mapping.js';
import { createNewReply } from '../../services/replies.js';
import { logger } from '../../utils/logger.js';
import { MESSAGES } from '../../constants/messages.js';
import { waSendText, waGetQuotedMessageId, waGetContactName } from '../wa-bridge.js';
import type { Config } from '../../types/index.js';

export async function handleGroupMessage(
  message: Message,
  _config: Config
): Promise<void> {
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
    const quotedMsgId = await waGetQuotedMessageId(message.id._serialized);

    if (!quotedMsgId) {
      logger.bot.debug('Could not resolve quoted message');
      return;
    }

    const mappingResult = await resolveMessageMapping(quotedMsgId);

    if (!mappingResult.success) {
      logger.bot.error('Failed to resolve mapping', mappingResult.error);
      await waSendText(message.from, MESSAGES.ERROR_GENERIC);
      return;
    }

    if (!mappingResult.data) {
      logger.bot.debug('Reply is not to a tracked message');
      return;
    }

    const resolved = mappingResult.data;
    const question = resolved.question;
    const parentReply = resolved.reply ?? null;

    const replyResult = await createNewReply(
      authorId,
      text,
      message.id._serialized,
      question.id,
      parentReply?.id ?? null
    );

    if (!replyResult.success) {
      logger.bot.error('Failed to create reply', replyResult.error);
      await waSendText(message.from, MESSAGES.ERROR_GENERIC);
      return;
    }

    const senderName = await waGetContactName(authorId);

    const replyMessage = MESSAGES.REPLY_TO_ASKER(
      question.question_id,
      replyResult.data.reply_id,
      senderName,
      text
    );

    await waSendText(question.author_whatsapp_id, replyMessage);

    logger.bot.info(
      `Forwarded reply ${replyResult.data.reply_id} to question asker`
    );
  } catch (error) {
    logger.bot.error('Error handling group message', error);
    await waSendText(message.from, MESSAGES.ERROR_GENERIC);
  }
}
