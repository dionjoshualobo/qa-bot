/**
 * WhatsApp-related types
 */

export interface WhatsAppMessage {
  id: string;
  body: string;
  from: string;
  to: string;
  timestamp: number;
  hasQuotedMsg: boolean;
  quotedMsg?: QuotedMessage;
  author?: string;
  fromMe: boolean;
}

export interface QuotedMessage {
  id: string;
  body: string;
  from: string;
}
