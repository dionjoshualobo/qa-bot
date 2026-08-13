import Database from 'better-sqlite3';
import { SCHEMA } from '../database/schema.js';

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  db.exec(SCHEMA.users);
  db.exec(SCHEMA.questions);
  db.exec(SCHEMA.question_counters);
  db.exec(SCHEMA.seed_question_counter);
  db.exec(SCHEMA.replies);
  db.exec(SCHEMA.message_mappings);
  db.exec(SCHEMA.pending_questions);

  for (const indexSql of SCHEMA.indexes) {
    db.exec(indexSql);
  }

  return db;
}

export function insertTestUser(db: Database.Database, whatsappId: string) {
  db.prepare('INSERT OR IGNORE INTO users (whatsapp_id) VALUES (?)').run(whatsappId);
}
