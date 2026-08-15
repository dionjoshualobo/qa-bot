/**
 * Identity helpers - resolve which WhatsApp JIDs belong to the bot owner.
 *
 * The bot can run on the owner's own WhatsApp account, in which case the owner
 * is identified from the connected account itself (no OWNER_WHATSAPP_ID needed).
 * JIDs can arrive in phone-number (@s.whatsapp.net) or LID (@lid) format, so
 * both forms of the account's own identity are considered.
 */

import type { WASocket } from '@whiskeysockets/baileys';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import type { Config } from '../types/index.js';

function selfJids(sock: WASocket): string[] {
  const me = sock.user;
  if (!me) return [];
  const jids = new Set<string>();
  if (me.id) jids.add(jidNormalizedUser(me.id));
  if (me.jid) jids.add(jidNormalizedUser(me.jid));
  if (me.lid) jids.add(jidNormalizedUser(me.lid));
  return [...jids];
}

/**
 * Every JID that identifies the owner: the configured OWNER_WHATSAPP_ID
 * (if set) plus the connected account's own JIDs.
 */
export function getOwnerJids(sock: WASocket, config: Config): string[] {
  const jids = new Set<string>();
  if (config.bot.ownerJid) jids.add(config.bot.ownerJid);
  for (const jid of selfJids(sock)) jids.add(jid);
  return [...jids];
}

export function isOwnerJid(
  sock: WASocket,
  config: Config,
  jid: string | null | undefined,
): boolean {
  if (!jid) return false;
  return getOwnerJids(sock, config).includes(jid);
}

/**
 * JID to send owner-directed messages to (previews, approve/reject
 * confirmations). Falls back to the connected account when OWNER_WHATSAPP_ID
 * is not set.
 */
export function getOwnerJid(sock: WASocket, config: Config): string {
  if (config.bot.ownerJid) return config.bot.ownerJid;
  const me = sock.user;
  if (me?.id) return jidNormalizedUser(me.id);
  return '';
}
