/**
 * Private chat message handler
 */

import type { WASocket } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { createNewQuestion, generateQuestionId, deleteUserData } from '../../services/questions.js';
import { createNewReply } from '../../services/replies.js';
import { resolveMessageMapping } from '../../services/mapping.js';
import {
  createPendingQuestion,
  getPendingByPreview,
  markPosted,
  markRejected,
} from '../../services/pendingQuestions.js';
import { getLatestPending } from '../../database/queries/pendingQuestions.js';
import { updateReplyGroupMessageId } from '../../database/queries/replies.js';
import { createMapping } from '../../database/queries/mappings.js';
import { getNextQuestionNumber } from '../../database/queries/questions.js';
import { startSession, endSession, isSessionActive } from '../sessions.js';
import { getOwnerJid, isOwnerJid } from '../identity.js';
import { logger } from '../../utils/logger.js';
import { MESSAGES } from '../../constants/messages.js';
import type { Config } from '../../types/index.js';

function hasImage(message: any): boolean {
  return !!message?.message?.imageMessage;
}

function getContextInfo(message: any): any {
  return (
    message?.message?.extendedTextMessage?.contextInfo ||
    message?.message?.imageMessage?.contextInfo
  );
}

async function sendToGroup(
  sock: WASocket,
  groupId: string,
  text: string,
  message: any,
  targetGroupMsgId?: string,
  targetParticipant?: string,
): Promise<any> {
  const options: any = {};
  if (targetGroupMsgId) {
    options.quoted = {
      key: {
        remoteJid: groupId,
        id: targetGroupMsgId,
        participant: targetParticipant,
      },
      message: { conversation: '' },
    };
  }

  if (hasImage(message)) {
    const buffer = await downloadMediaMessage(message, 'buffer', {});
    return sock.sendMessage(
      groupId,
      {
        image: buffer,
        caption: text,
      },
      options,
    );
  }
  return sock.sendMessage(groupId, { text }, options);
}

export async function handlePrivateMessage(
  sock: WASocket,
  message: any,
  text: string,
  config: Config,
): Promise<void> {
  const senderJid = message.key.fromMe ? getOwnerJid(sock, config) : message.key.remoteJid!;
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
  const contextInfo = getContextInfo(message);
  const quotedMsgId = contextInfo?.stanzaId;

  // Helper to check for approve/reject commands
  const checkApprovalCommand = async (pending: any) => {
    const trimmedLower = text.trim().toLowerCase();
    if (trimmedLower === 'approve' || trimmedLower.startsWith('approve ')) {
      await handleApprove(sock, pending, config);
      return true;
    }
    if (trimmedLower === 'reject' || trimmedLower.startsWith('reject ')) {
      await handleReject(sock, pending, text.trim(), config);
      return true;
    }
    return false;
  };

  const isApprovalText = (t: string) => {
    const lower = t.trim().toLowerCase();
    return (
      lower === 'approve' ||
      lower === 'reject' ||
      lower.startsWith('approve ') ||
      lower.startsWith('reject ')
    );
  };

  // Approval flow for owner
  if (isOwnerJid(sock, config, senderJid) && isApprovalText(trimmed)) {
    logger.bot.debug(`Processing approval command from owner: ${senderJid}`);
    if (quotedMsgId) {
      const pendingResult = getPendingByPreview(quotedMsgId);
      if (pendingResult.success && pendingResult.data?.status === 'pending') {
        if (await checkApprovalCommand(pendingResult.data)) {
          return;
        }
      }
    }

    // Fallback to latest pending question if quoted message ID lookup failed or unquoted
    const latestResult = getLatestPending();
    if (latestResult.success && latestResult.data && latestResult.data.status === 'pending') {
      if (await checkApprovalCommand(latestResult.data)) {
        return;
      }
    }
  }

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
        trimmed,
        message.key?.id ?? '',
        question.id,
        parentReply?.id ?? null,
      );

      if (!replyResult.success) {
        logger.bot.error('Failed to create reply', replyResult.error);
        await sock.sendMessage(authorId, { text: MESSAGES.ERROR_GENERIC });
        return;
      }

      // Post to group (with image if present)
      const targetGroupMsgId = parentReply
        ? parentReply.group_message_id
        : question.group_message_id;
      const targetParticipant = parentReply ? parentReply.author_whatsapp_id : undefined;

      const sentToGroup = await sendToGroup(
        sock,
        config.bot.groupId,
        MESSAGES.REPLY_TEMPLATE(question.question_id, replyResult.data.reply_id, trimmed),
        message,
        targetGroupMsgId,
        targetParticipant,
      );

      // Store mapping for group message so others can reply to it, and fix
      // the reply's group_message_id to the actual group post id (the reply
      // row was created with the asker's DM message id).
      if (sentToGroup?.key?.id) {
        const mappingResult = createMapping({
          whatsapp_message_id: sentToGroup.key.id,
          question_id: null,
          reply_id: replyResult.data.id,
        });

        if (!mappingResult.success) {
          logger.bot.error(
            `Failed to create mapping for posted reply ${replyResult.data.reply_id}`,
            mappingResult.error,
          );
        }

        const updateResult = updateReplyGroupMessageId(replyResult.data.id, sentToGroup.key.id);
        if (!updateResult.success) {
          logger.bot.error(
            `Failed to update group message id for reply ${replyResult.data.reply_id}`,
            updateResult.error,
          );
        }
      }

      // Confirm to user
      await sock.sendMessage(authorId, {
        text: MESSAGES.SUCCESS_REPLY_FORWARDED(replyResult.data.reply_id),
      });

      logger.bot.info(`Posted reply ${replyResult.data.reply_id} to group from private chat`);
      return;
    }
  }

  // Not a reply to forwarded message or not approve/reject — check for /q or /question command
  const match = trimmed.match(/^\/(?:q|question)\s+(.*)/is);
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
    // Buffer image if present
    let imageBuffer: Buffer | null = null;
    if (hasImage(message)) {
      imageBuffer = await downloadMediaMessage(message, 'buffer', {});
    }

    // Send preview to owner and capture the preview message ID
    const ownerJid = getOwnerJid(sock, config);
    const previewMsg = await sock.sendMessage(ownerJid, {
      text: MESSAGES.PENDING_QUESTION_PREVIEW(authorId, questionText),
    });
    const previewMsgId = previewMsg?.key?.id ?? '';

    // Create pending question row
    const pendingResult = await createPendingQuestion(
      authorId,
      questionText,
      imageBuffer,
      previewMsgId,
    );
    if (!pendingResult.success) {
      logger.bot.error('Failed to create pending question', pendingResult.error);
      await sock.sendMessage(authorId, { text: MESSAGES.ERROR_GENERIC });
      return;
    }

    // Confirm to asker
    await sock.sendMessage(authorId, { text: MESSAGES.SUCCESS_QUESTION_SUBMITTED });

    logger.bot.info(`Pending question submitted by ${authorId} for review`);
  } catch (error) {
    logger.bot.error('Error handling private message', error);
    await sock.sendMessage(message.key.remoteJid!, { text: MESSAGES.ERROR_GENERIC });
  }
}

async function handleApprove(sock: WASocket, pending: any, config: Config): Promise<void> {
  const ownerJid = getOwnerJid(sock, config);

  // Generate question ID
  const nextNumResult = getNextQuestionNumber();
  if (!nextNumResult.success) {
    logger.bot.error('Failed to get next question number', nextNumResult.error);
    await sock.sendMessage(ownerJid, { text: MESSAGES.ERROR_GENERIC });
    return;
  }

  const questionId = generateQuestionId(nextNumResult.data);

  // Post to group (with image if any)
  const sent = await sendToGroupWithBuffer(
    sock,
    config.bot.groupId,
    MESSAGES.QUESTION_TEMPLATE(questionId, pending.text),
    pending.image_buffer,
  );
  const groupMsgId = sent?.key?.id ?? '';

  // Create question in database
  const questionResult = await createNewQuestion(
    pending.asker_whatsapp_id,
    pending.text,
    groupMsgId,
    questionId,
  );

  if (!questionResult.success) {
    logger.bot.error('Failed to create question', questionResult.error);
    await sock.sendMessage(ownerJid, { text: MESSAGES.ERROR_GENERIC });
    return;
  }

  // Mark pending as posted
  markPosted(pending.id);

  // Activate session for asker
  startSession(pending.asker_whatsapp_id);

  // Confirm to asker
  await sock.sendMessage(pending.asker_whatsapp_id, {
    text: MESSAGES.SUCCESS_QUESTION_POSTED(questionId),
  });

  // Confirm to owner
  await sock.sendMessage(ownerJid, {
    text: MESSAGES.APPROVED_NOTIFY_OWNER(questionId),
  });

  logger.bot.info(`Approved and posted question ${questionId} to group`);
}

async function handleReject(
  sock: WASocket,
  pending: any,
  rawText: string,
  config: Config,
): Promise<void> {
  const ownerJid = getOwnerJid(sock, config);

  // Extract reason: "reject" or "reject some reason" → "some reason"
  const reason = rawText.replace(/^reject\s*/i, '').trim();

  markRejected(pending.id);

  // Notify asker
  await sock.sendMessage(pending.asker_whatsapp_id, {
    text: MESSAGES.REJECTED_NOTIFY_ASKER,
  });

  // Notify owner
  await sock.sendMessage(ownerJid, {
    text: MESSAGES.REJECTED_NOTIFY_OWNER(pending.text, reason),
  });

  logger.bot.info(`Rejected question from ${pending.asker_whatsapp_id}`);
}

async function sendToGroupWithBuffer(
  sock: WASocket,
  groupId: string,
  text: string,
  imageBuffer: Buffer | null,
): Promise<any> {
  if (imageBuffer) {
    return sock.sendMessage(groupId, { image: imageBuffer, caption: text });
  }
  return sock.sendMessage(groupId, { text });
}
