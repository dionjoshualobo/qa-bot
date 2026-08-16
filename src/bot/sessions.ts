import { getDatabase } from '../database/database.js';

const activeSessions = new Set<string>();

export function isSessionActive(jid: string): boolean {
  if (activeSessions.has(jid)) {
    return true;
  }
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT 1 FROM questions WHERE author_whatsapp_id = ? LIMIT 1').get(jid);
    if (row) {
      activeSessions.add(jid);
      return true;
    }
  } catch {}
  return false;
}

export function startSession(jid: string): void {
  activeSessions.add(jid);
}

export function endSession(jid: string): void {
  activeSessions.delete(jid);
}
