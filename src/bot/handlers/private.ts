/**
 * Private chat message handler
 */

import type { WASocket } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { createNewQuestion, generateQuestionId } from '../../services/questions.js';
import { createNewReply } from '../../services/replies.js';
import { resolveMessageMapping } from '../../services/mapping.js';
import { createMapping } from '../../database/queries/mappings.js';
import { getNextQuestionNumber } from '../../database/queries/questions.js';
import { startSession, endSession } from '../sessions.js';
import { logger } from '../../utils/logger.js';
import { MESSAGES } from '../../constants/messages.js';
import type { Config } from '../../types/index.js';

function hasImage(message: any): boolean {
  return !!message?.message?.imageMessage;
}

async function sendToGroup(
  sock: WASocket,
  groupId: string,
  text: string,
  message: any
): Promise<any> {
  if (hasImage(message)) {
    const buffer = await downloadMediaMessage(message, 'buffer', {});
    return sock.sendMessage(groupId, {
      image: buffer,
      caption: text,
    });
  }
  return sock.sendMessage(groupId, { text });
}

export async function handlePrivateMessage(
  sock: WASocket,
  message: any,
  text: string,
  config: Config
): Promise<void> {
  const authorId = message.key.remoteJid!;
  const trimmed = text.trim();

  // Handle /help
  if (/^\/help$/i.test(trimmed)) {
    await sock.sendMessage(authorId, { text: MESSAGES.HELP });
    return;
  }

  // Handle /exit
  if (/^\/exit$/i.test(trimmed)) {
    endSession(authorId);
    await sock.sendMessage(authorId, { text: MESSAGES.SESSION_ENDED });
    logger.bot.info(`Session ended for ${authorId}`);
    return;
  }

  // Check if this is a reply to a forwarded message
  const contextInfo = message.message?.extendedTextMessage?.contextInfo;
  const quotedMsgId = contextInfo?.stanzaId;

  if (quotedMsgId) {
    // This is a reply to something - check if we forwarded it
    const mappingResult = await resolveMessageMapping(quotedMsgId);

    if (mappingResult.success && mappingResult.data) {
      const resolved = mappingResult.data;
      const question = resolved.question;
      const parentReply = resolved.reply ?? null;

      // Create reply in database
      const replyResult = await createNewReply(
        authorId,
        text,
        message.key?.id ?? '',
        question.id,
        parentReply?.id ?? null
      );

      if (!replyResult.success) {
        logger.bot.error('Failed to create reply', replyResult.error);
        await sock.sendMessage(authorId, { text: MESSAGES.ERROR_GENERIC });
        return;
      }

      // Post to group (with image if present)
      const sentToGroup = await sendToGroup(
        sock,
        config.bot.groupId,
        MESSAGES.REPLY_TEMPLATE(
          question.question_id,
          replyResult.data.reply_id,
          text
        ),
        message
      );

      // Store mapping for group message so others can reply to it
      if (sentToGroup?.key?.id) {
        createMapping({
          whatsapp_message_id: sentToGroup.key.id,
          question_id: null,
          reply_id: replyResult.data.id,
        });
      }

      // Confirm to user
      await sock.sendMessage(authorId, {
        text: MESSAGES.SUCCESS_REPLY_FORWARDED(replyResult.data.reply_id),
      });

      logger.bot.info(
        `Posted reply ${replyResult.data.reply_id} to group from private chat`
      );
      return;
    }
  }

  // Not a reply to forwarded message - check for /q or /question command
  const match = text.match(/^\/(?:q|question)\s+(.*)/is);
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

    // Generate question ID first
    const nextNumResult = getNextQuestionNumber();
    if (!nextNumResult.success) {
      logger.bot.error('Failed to get next question number', nextNumResult.error);
      await sock.sendMessage(authorId, { text: MESSAGES.ERROR_GENERIC });
      return;
    }

    const questionId = generateQuestionId(nextNumResult.data);

    // Post question to group with actual ID (with image if present)
    const sent = await sendToGroup(
      sock,
      groupId,
      MESSAGES.QUESTION_TEMPLATE(questionId, questionText),
      message
    );
    const groupMsgId = sent?.key?.id ?? '';

    // Create question in database
    const questionResult = await createNewQuestion(authorId, questionText, groupMsgId, questionId);

    if (!questionResult.success) {
      logger.bot.error('Failed to create question', questionResult.error);
      await sock.sendMessage(authorId, { text: MESSAGES.ERROR_GENERIC });
      return;
    }

    // Activate session
    startSession(authorId);

    // Confirm to user
    await sock.sendMessage(authorId, {
      text: MESSAGES.SUCCESS_QUESTION_POSTED(questionId),
    });

    logger.bot.info(`Posted question ${questionId} to group`);
  } catch (error) {
    logger.bot.error('Error handling private message', error);
    await sock.sendMessage(message.key.remoteJid!, { text: MESSAGES.ERROR_GENERIC });
  }
}
