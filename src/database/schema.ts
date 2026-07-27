/**
 * Database schema definitions
 */

export const SCHEMA = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      whatsapp_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,

  questions: `
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT NOT NULL UNIQUE,
      author_whatsapp_id TEXT NOT NULL,
      text TEXT NOT NULL,
      group_message_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (author_whatsapp_id) REFERENCES users(whatsapp_id)
    )
  `,

  question_counters: `
    CREATE TABLE IF NOT EXISTS question_counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    )
  `,

  replies: `
    CREATE TABLE IF NOT EXISTS replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reply_id TEXT NOT NULL UNIQUE,
      question_id INTEGER NOT NULL,
      parent_reply_id INTEGER,
      group_message_id TEXT NOT NULL,
      author_whatsapp_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (parent_reply_id) REFERENCES replies(id),
      FOREIGN KEY (author_whatsapp_id) REFERENCES users(whatsapp_id)
    )
  `,

  message_mappings: `
    CREATE TABLE IF NOT EXISTS message_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      whatsapp_message_id TEXT NOT NULL UNIQUE,
      question_id INTEGER,
      reply_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (question_id) REFERENCES questions(id),
      FOREIGN KEY (reply_id) REFERENCES replies(id),
      CHECK (
        (question_id IS NOT NULL AND reply_id IS NULL) OR
        (question_id IS NULL AND reply_id IS NOT NULL)
      )
    )
  `,

  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_users_whatsapp_id ON users(whatsapp_id)',
    'CREATE INDEX IF NOT EXISTS idx_questions_question_id ON questions(question_id)',
    'CREATE INDEX IF NOT EXISTS idx_questions_author ON questions(author_whatsapp_id)',
    'CREATE INDEX IF NOT EXISTS idx_questions_group_message ON questions(group_message_id)',
    'CREATE INDEX IF NOT EXISTS idx_replies_reply_id ON replies(reply_id)',
    'CREATE INDEX IF NOT EXISTS idx_replies_question ON replies(question_id)',
    'CREATE INDEX IF NOT EXISTS idx_replies_parent ON replies(parent_reply_id)',
    'CREATE INDEX IF NOT EXISTS idx_replies_group_message ON replies(group_message_id)',
    'CREATE INDEX IF NOT EXISTS idx_mappings_whatsapp_message ON message_mappings(whatsapp_message_id)',
    'CREATE INDEX IF NOT EXISTS idx_mappings_question ON message_mappings(question_id)',
    'CREATE INDEX IF NOT EXISTS idx_mappings_reply ON message_mappings(reply_id)',
  ],

  seed_question_counter: `
    INSERT OR IGNORE INTO question_counters (name, value)
    SELECT 'questions', COALESCE(MAX(value), 0)
    FROM (
      SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'questions'), 0) AS value
      UNION ALL
      SELECT COALESCE(MAX(CAST(SUBSTR(question_id, 2) AS INTEGER)), 0) AS value
      FROM questions
      WHERE question_id GLOB 'Q[0-9]*'
    )
  `,
};
