/**
 * User database queries
 */

import { getDatabase } from '../database.js';
import type { User, UserInsert, Result } from '../../types/index.js';
import { ok, err } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export function createUser(data: UserInsert): Result<User, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (whatsapp_id)
      VALUES (?)
    `);
    
    const info = stmt.run(data.whatsapp_id);
    
    const user = getUserById(Number(info.lastInsertRowid));
    if (!user.success) {
      return user;
    }
    
    logger.db.debug(`Created user: ${data.whatsapp_id}`);
    return ok(user.data);
  } catch (error) {
    logger.db.error('Failed to create user', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getUserById(id: number): Result<User, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM users WHERE id = ?
    `);
    
    const user = stmt.get(id) as User | undefined;
    
    if (!user) {
      return err(new Error(`User not found: ${id}`));
    }
    
    return ok(user);
  } catch (error) {
    logger.db.error('Failed to get user by id', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getUserByWhatsAppId(whatsappId: string): Result<User | null, Error> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM users WHERE whatsapp_id = ?
    `);
    
    const user = stmt.get(whatsappId) as User | undefined;
    
    return ok(user ?? null);
  } catch (error) {
    logger.db.error('Failed to get user by WhatsApp ID', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getOrCreateUser(whatsappId: string): Result<User, Error> {
  const existingUser = getUserByWhatsAppId(whatsappId);
  
  if (!existingUser.success) {
    return existingUser;
  }
  
  if (existingUser.data) {
    return ok(existingUser.data);
  }
  
  return createUser({ whatsapp_id: whatsappId });
}
