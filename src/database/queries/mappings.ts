/**
 * Message mapping database queries
 */

import { getDatabase } from '../database.js';
import type { MessageMapping, MessageMappingInsert, Result } from '../../types/index.js';
import { ok, err } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export function createMapping(data: MessageMappingInsert): Result<MessageMapping, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO message_mappings (whatsapp_message_id, question_id, reply_id)
      VALUES (?, ?, ?)
    `);
    
    const info = stmt.run(
      data.whatsapp_message_id,
      data.question_id,
      data.reply_id
    );
    
    const mapping = getMappingById(Number(info.lastInsertRowid));
    if (!mapping.success) {
      return mapping;
    }
    
    logger.db.debug(`Created mapping for message: ${data.whatsapp_message_id}`);
    return ok(mapping.data);
  } catch (error) {
    logger.db.error('Failed to create mapping', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getMappingById(id: number): Result<MessageMapping, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM message_mappings WHERE id = ?
    `);
    
    const mapping = stmt.get(id) as MessageMapping | undefined;
    
    if (!mapping) {
      return err(new Error(`Mapping not found: ${id}`));
    }
    
    return ok(mapping);
  } catch (error) {
    logger.db.error('Failed to get mapping by id', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getMappingByWhatsAppMessageId(whatsappMessageId: string): Result<MessageMapping | null, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM message_mappings WHERE whatsapp_message_id = ?
    `);
    
    const mapping = stmt.get(whatsappMessageId) as MessageMapping | undefined;
    
    return ok(mapping ?? null);
  } catch (error) {
    logger.db.error('Failed to get mapping by WhatsApp message id', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
