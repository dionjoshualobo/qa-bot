/**
 * Private chat message handler
 */

import type { WASocket } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { createNewQuestion, generateQuestionId, deleteUserData } from '../../services/questions.js';
import { createNewReply } from '../../services/replies.js';
import { resolveMessageMapping } from '../../services/mapping.js';
import { createMapping } from '../../database/queries/mappings.js';
import { getNextQuestionNumber } from '../../database/queries/questions.js';
import { startSession, endSession, isSessionActive } from '../sessions.js';
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
  message: any,
  targetGroupMsgId?: string,
  targetParticipant?: string
): Promise<any> {
  const options: any = {};
  if (targetGroupMsgId) {
    options.quoted = {
      key: {
        remoteJid: groupId,
        id: targetGroupMsgId,
        participant: targetParticipant
      },
      message: { conversation: '' }
    };
  }

  if (hasImage(message)) {
    const buffer = await downloadMediaMessage(message, 'buffer', {});
    return sock.sendMessage(groupId, {
      image: buffer,
      caption: text,
    }, options);
  }
  return sock.sendMessage(groupId, { text }, options);
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

  // Handle /repo
  if (/^\/repo$/i.test(trimmed)) {
    await sock.sendMessage(authorId, { text: MESSAGES.REPO });
    return;
  }

  // Handle /exit with optional message
  const exitMatch = trimmed.match(/^\/exit\s*(.*)/is);
  if (exitMatch) {
    const exitMessage = exitMatch[1]?.trim();
    
    // Post exit message to group if provided
    if (exitMessage) {
      await sock.sendMessage(config.bot.groupId, {
        text: MESSAGES.EXIT_MESSAGE(exitMessage),
      });
    }
    
    endSession(authorId);
    deleteUserData(authorId);
    await sock.sendMessage(authorId, { text: MESSAGES.SESSION_ENDED });
    logger.bot.info(`Session ended and data cleaned for ${authorId}`);
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
      const targetGroupMsgId = parentReply ? parentReply.group_message_id : question.group_message_id;
      const targetParticipant = parentReply ? parentReply.author_whatsapp_id : undefined;

      const sentToGroup = await sendToGroup(
        sock,
        config.bot.groupId,
        MESSAGES.REPLY_TEMPLATE(
          question.question_id,
          replyResult.data.reply_id,
          text
        ),
        message,
        targetGroupMsgId,
        targetParticipant
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

  // Check if user already has active session
  if (isSessionActive(authorId)) {
    await sock.sendMessage(authorId, { text: MESSAGES.SESSION_ACTIVE });
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
