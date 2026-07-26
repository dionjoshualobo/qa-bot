/**
 * Event handlers for WhatsApp client
 * Wires up message handlers to client events
 */

import type { Client, Message } from 'whatsapp-web.js';
import { handlePrivateMessage } from './handlers/private.js';
import { handleGroupMessage } from './handlers/group.js';
import { logger } from '../utils/logger.js';
import type { Config } from '../types/index.js';

export function registerEventHandlers(client: Client, config: Config): void {
  logger.bot.info('Registering event handlers');

  client.on('message', async (message: Message) => {
    try {
      if (message.fromMe) return;

      const from: string = message.from;

      // Group messages have @g.us suffix
      if (from.endsWith('@g.us')) {
        if (from === config.bot.groupId) {
          await handleGroupMessage(message, config);
        }
        return;
      }

      // Ignore newsletter messages
      if (from.endsWith('@newsletter')) return;

      // Everything else is a private message
      await handlePrivateMessage(message, config);
    } catch (error) {
      logger.bot.error('Error in message handler', error);
    }
  });

  logger.bot.info('Event handlers registered successfully');
}
