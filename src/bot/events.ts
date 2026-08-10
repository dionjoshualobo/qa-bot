/**
 * Event handlers for WhatsApp client
 */

import { isJidGroup } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { handlePrivateMessage } from './handlers/private.js';
import { handleGroupMessage } from './handlers/group.js';
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

export function registerEventHandlers(sock: WASocket, config: Config): void {
  logger.bot.info('Registering event handlers');

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const message of messages) {
      try {
        if (message.key.fromMe) continue;

        const from = message.key.remoteJid!;
        const text = extractText(message);

        if (!text) continue;

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
