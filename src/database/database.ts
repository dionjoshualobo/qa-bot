/**
 * Database initialization and connection management
 */

import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import { logger } from '../utils/logger.js';
import type { Result } from '../types/index.js';
import { ok, err } from '../types/index.js';

let db: Database.Database | null = null;

export function initDatabase(dbPath: string): Result<Database.Database, Error> {
  try {
    logger.db.info(`Initializing database at ${dbPath}`);
    
    db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Create tables
    db.exec(SCHEMA.users);
    db.exec(SCHEMA.questions);
    db.exec(SCHEMA.replies);
    db.exec(SCHEMA.message_mappings);
    
    // Create indexes
    for (const indexSql of SCHEMA.indexes) {
      db.exec(indexSql);
    }
    
    logger.db.info('Database initialized successfully');
    return ok(db);
  } catch (error) {
    logger.db.error('Failed to initialize database', error);
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    logger.db.info('Closing database connection');
    db.close();
    db = null;
  }
}
