/**
 * Database entity types
 */

export interface User {
  id: number;
  whatsapp_id: string;
  created_at: string;
}

export interface Question {
  id: number;
  question_id: string;
  author_whatsapp_id: string;
  text: string;
  group_message_id: string;
  created_at: string;
}

export interface Reply {
  id: number;
  reply_id: string;
  question_id: number;
  parent_reply_id: number | null;
  group_message_id: string;
  author_whatsapp_id: string;
  text: string;
  created_at: string;
}

export interface MessageMapping {
  id: number;
  whatsapp_message_id: string;
  question_id: number | null;
  reply_id: number | null;
  created_at: string;
}

export type PendingQuestionStatus = 'pending' | 'posted' | 'rejected';

export interface PendingQuestion {
  id: number;
  asker_whatsapp_id: string;
  text: string;
  image_buffer: Buffer | null;
  preview_message_id: string;
  status: PendingQuestionStatus;
  created_at: string;
}

export interface PendingQuestionInsert {
  asker_whatsapp_id: string;
  text: string;
  image_buffer: Buffer | null;
  preview_message_id: string;
}

/**
 * Insert types (without auto-generated fields)
 */

export interface UserInsert {
  whatsapp_id: string;
}

export interface QuestionInsert {
  question_id: string;
  author_whatsapp_id: string;
  text: string;
  group_message_id: string;
}

export interface ReplyInsert {
  reply_id: string;
  question_id: number;
  parent_reply_id: number | null;
  group_message_id: string;
  author_whatsapp_id: string;
  text: string;
}

export interface MessageMappingInsert {
  whatsapp_message_id: string;
  question_id: number | null;
  reply_id: number | null;
}
