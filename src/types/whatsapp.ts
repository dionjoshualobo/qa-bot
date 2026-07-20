/**
 * WhatsApp-related types
 */

import type { Message, Chat } from 'whatsapp-web.js';

export interface WhatsAppMessage {
  id: string;
  body: string;
  from: string;
  to: string;
  timestamp: number;
  hasQuotedMsg: boolean;
  isGroup: boolean;
}

export interface QuotedMessage {
  id: string;
  body: string;
  from: string;
}

export type { Message, Chat };
