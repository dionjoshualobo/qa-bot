/**
 * Group chat message handler
 */

import type { WASocket } from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { resolveMessageMapping } from "../../services/mapping.js";
import { createNewReply } from "../../services/replies.js";
import { createMapping } from "../../database/queries/mappings.js";
import { isSessionActive } from "../sessions.js";
import { logger } from "../../utils/logger.js";
import { MESSAGES } from "../../constants/messages.js";
import type { Config } from "../../types/index.js";

function extractText(message: any): string {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    ""
  );
}

function hasImage(message: any): boolean {
  return !!message?.message?.imageMessage;
}

function getContextInfo(message: any): any {
  return (
    message?.message?.extendedTextMessage?.contextInfo ||
    message?.message?.imageMessage?.contextInfo
  );
}

export async function handleGroupMessage(
  sock: WASocket,
  message: any,
  _config: Config,
): Promise<void> {
  const text = extractText(message);

  // Handle /repo
  if (/^\/repo$/i.test(text.trim())) {
    const remoteJid = message.key?.remoteJid;
    if (remoteJid) {
      await sock.sendMessage(remoteJid, { text: MESSAGES.REPO });
    }
    return;
  }

  const contextInfo = getContextInfo(message);
  if (!contextInfo?.stanzaId) {
    logger.bot.debug("Ignoring non-reply message in group");
    return;
  }

  if (!text) {
    logger.bot.debug("Ignoring empty reply");
    return;
  }

  const authorId = message.key?.participant || message.key?.remoteJid;
  const quotedMsgId = contextInfo.stanzaId;
  const remoteJid = message.key?.remoteJid;
  const msgId = message.key?.id;

  if (!authorId || !remoteJid || !msgId) {
    logger.bot.debug("Missing sender, group info, or message ID");
    return;
  }

  logger.bot.info(`Received group reply from ${authorId}`);

  try {
    const mappingResult = await resolveMessageMapping(quotedMsgId);

    if (!mappingResult.success) {
      logger.bot.error("Failed to resolve mapping", mappingResult.error);
      await sock.sendMessage(remoteJid, { text: MESSAGES.ERROR_GENERIC });
      return;
    }

    if (!mappingResult.data) {
      logger.bot.debug("Reply is not to a tracked message");
      return;
    }

    const resolved = mappingResult.data;
    const question = resolved.question;
    const parentReply = resolved.reply ?? null;

    const replyResult = await createNewReply(
      authorId,
      text,
      msgId,
      question.id,
      parentReply?.id ?? null,
    );

    if (!replyResult.success) {
      logger.bot.error("Failed to create reply", replyResult.error);
      await sock.sendMessage(remoteJid, { text: MESSAGES.ERROR_GENERIC });
      return;
    }

    const senderName = message.pushName || "Anonymous";

    const replyMessage = MESSAGES.REPLY_TO_ASKER(
      question.question_id,
      replyResult.data.reply_id,
      senderName,
      text,
    );

    // Check if asker has active session before forwarding
    if (!isSessionActive(question.author_whatsapp_id)) {
      logger.bot.info(
        `Skipping forward - asker session inactive for ${question.author_whatsapp_id}`,
      );
      return;
    }

    // Forward to asker (with image if present)
    let sent;
    if (hasImage(message)) {
      const buffer = await downloadMediaMessage(message, "buffer", {});
      sent = await sock.sendMessage(question.author_whatsapp_id, {
        image: buffer,
        caption: replyMessage,
      });
    } else {
      sent = await sock.sendMessage(question.author_whatsapp_id, {
        text: replyMessage,
      });
    }

    // Store mapping for forwarded message so asker can reply to it
    if (sent?.key?.id) {
      createMapping({
        whatsapp_message_id: sent.key.id,
        question_id: null,
        reply_id: replyResult.data.id,
      });
    }

    logger.bot.info(
      `Forwarded reply ${replyResult.data.reply_id} to question asker`,
    );
  } catch (error) {
    logger.bot.error("Error handling group message", error);
    const remoteJid = message.key?.remoteJid;
    if (remoteJid) {
      await sock.sendMessage(remoteJid, { text: MESSAGES.ERROR_GENERIC });
    }
  }
}
