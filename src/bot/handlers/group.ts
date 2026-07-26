/**
 * Group chat message handler
 */

import type { WASocket } from '@whiskeysockets/baileys';
import { resolveMessageMapping } from '../../services/mapping.js';
import { createNewReply } from '../../services/replies.js';
import { logger } from '../../utils/logger.js';
import { MESSAGES } from '../../constants/messages.js';
import type { Config } from '../../types/index.js';

export async function handleGroupMessage(
  sock: WASocket,
  message: any,
  _config: Config
): Promise<void> {
  const contextInfo = message.message?.extendedTextMessage?.contextInfo;
  if (!contextInfo?.stanzaId) {
    logger.bot.debug('Ignoring non-reply message in group');
    return;
  }

  const text = message.message?.conversation
    || message.message?.extendedTextMessage?.text
    || '';

  if (!text) {
    logger.bot.debug('Ignoring empty reply');
    return;
  }

  const authorId = message.key?.participant || message.key?.remoteJid;
  const quotedMsgId = contextInfo.stanzaId;
  const remoteJid = message.key?.remoteJid;

  if (!authorId || !remoteJid) {
    logger.bot.debug('Missing sender or group info');
    return;
  }

  logger.bot.info(`Received group reply from ${authorId}`);

  try {
    const mappingResult = await resolveMessageMapping(quotedMsgId);

    if (!mappingResult.success) {
      logger.bot.error('Failed to resolve mapping', mappingResult.error);
      await sock.sendMessage(remoteJid, { text: MESSAGES.ERROR_GENERIC });
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
      message.key?.id ?? '',
      question.id,
      parentReply?.id ?? null
    );

    if (!replyResult.success) {
      logger.bot.error('Failed to create reply', replyResult.error);
      await sock.sendMessage(remoteJid, { text: MESSAGES.ERROR_GENERIC });
      return;
    }

    const senderName = message.pushName || 'Anonymous';

    const replyMessage = MESSAGES.REPLY_TO_ASKER(
      question.question_id,
      replyResult.data.reply_id,
      senderName,
      text
    );

    await sock.sendMessage(question.author_whatsapp_id, { text: replyMessage });

    logger.bot.info(
      `Forwarded reply ${replyResult.data.reply_id} to question asker`
    );
  } catch (error) {
    logger.bot.error('Error handling group message', error);
    const remoteJid = message.key?.remoteJid;
    if (remoteJid) {
      await sock.sendMessage(remoteJid, { text: MESSAGES.ERROR_GENERIC });
    }
  }
}
