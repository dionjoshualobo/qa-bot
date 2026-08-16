/**
 * Event handlers for WhatsApp client
 */

import { isJidGroup, extractMessageContent } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { handlePrivateMessage } from './handlers/private.js';
import { handleGroupMessage } from './handlers/group.js';
import { cacheMessage, isBotSentMessage } from './client.js';
import { logger } from '../utils/logger.js';
import type { Config } from '../types/index.js';

function extractText(message: any): string {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    ''
  );
}

const BOT_START_TIME = Math.floor(Date.now() / 1000);

export function registerEventHandlers(sock: WASocket, config: Config): void {
  logger.bot.info('Registering event handlers');

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    logger.wa.info(`[UPSERT] Received ${messages.length} messages (type=${type})`);

    for (const rawMessage of messages) {
      const rawFrom = rawMessage.key?.remoteJid || 'unknown';
      const rawId = rawMessage.key?.id || 'no-id';
      const rawFromMe = rawMessage.key?.fromMe;
      const hasMsg = !!rawMessage.message;
      const msgTimestamp = Number(rawMessage.messageTimestamp || 0);

      logger.wa.info(
        `[RAW] from=${rawFrom} fromMe=${rawFromMe} hasMessage=${hasMsg} ts=${msgTimestamp} id=${rawId}`,
      );

      // Ignore offline backlog messages sent before bot startup
      if (msgTimestamp > 0 && msgTimestamp < BOT_START_TIME - 10) {
        logger.wa.debug(`[SKIP] Offline backlog (ts=${msgTimestamp} < start=${BOT_START_TIME})`);
        continue;
      }

      if (rawMessage.key?.id && rawMessage.message) {
        cacheMessage(rawMessage.key.id, rawMessage.message);
      }

      // Skip automated messages sent by this bot instance
      if (rawMessage.key?.id && isBotSentMessage(rawMessage.key.id)) {
        logger.wa.debug(`[SKIP] Bot-sent message id=${rawId}`);
        continue;
      }

      try {
        const from = rawMessage.key.remoteJid!;

        // Unwrap ephemeralMessage/viewOnceMessage/editedMessage wrappers so
        // handlers see the actual content (Baileys delivers the raw protobuf)
        const message = { ...rawMessage, message: extractMessageContent(rawMessage.message) };

        const text = extractText(message);

        if (!text) {
          logger.wa.debug(`[SKIP] No text extracted from ${rawFrom} id=${rawId}`);
          continue;
        }

        logger.wa.info(
          `[INCOMING] From: ${from} (fromMe=${!!rawMessage.key.fromMe}) | Content: "${text}" | ID: ${rawMessage.key.id}`,
        );

        if (isJidGroup(from)) {
          if (from === config.bot.groupId) {
            await handleGroupMessage(sock, message, config);
          }
          continue;
        }

        // Private messages: JID with no @ or @lid
        if (
          !from.endsWith('@g.us') &&
          !from.endsWith('@newsletter') &&
          !from.endsWith('@broadcast')
        ) {
          await handlePrivateMessage(sock, message, text, config);
        }
      } catch (error) {
        logger.bot.error('Error in message handler', error);
      }
    }
  });

  logger.bot.info('Event handlers registered successfully');
}
