/**
 * Session management - tracks which users have active Q&A sessions
 */

const activeSessions = new Set<string>();

export function isSessionActive(jid: string): boolean {
  return activeSessions.has(jid);
}

export function startSession(jid: string): void {
  activeSessions.add(jid);
}

export function endSession(jid: string): void {
  activeSessions.delete(jid);
}
