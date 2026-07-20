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
      const chat = await message.getChat();

      // Ignore messages from self
      if (message.fromMe) {
        return;
      }

      // Handle group messages
      if (chat.isGroup) {
        // Only handle messages in the configured group
        if (chat.id._serialized === config.bot.groupId) {
          await handleGroupMessage(message, config);
        }
        return;
      }

      // Handle private messages
      await handlePrivateMessage(message, config);
    } catch (error) {
      logger.bot.error('Error in message handler', error);
    }
  });

  logger.bot.info('Event handlers registered successfully');
}
