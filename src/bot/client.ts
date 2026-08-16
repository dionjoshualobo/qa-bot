/**
 * WhatsApp client wrapper using Baileys
 */

import {
  makeWASocket,
  fetchLatestWaWebVersion,
  useMultiFileAuthState,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import type { WASocket, CacheStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';

let sock: WASocket | null = null;
let connectionPromise: Promise<void> | null = null;
let connectionResolve: (() => void) | null = null;
let isShuttingDown = false;
let storedOnReady: ((sock: WASocket) => void) | null = null;
let isSelfHealingInitialized = false;

function setupSelfHealingSessionHandler(sessionPath: string): void {
  if (isSelfHealingInitialized) return;
  isSelfHealingInitialized = true;
  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    origConsoleError(...args);
    try {
      const msg = args.map((a) => (typeof a === 'string' ? a : a?.stack || String(a))).join(' ');
      if (
        msg.includes('Failed to decrypt message') ||
        msg.includes('Bad MAC') ||
        msg.includes('MessageCounterError')
      ) {
        const match = msg.match(/at (?:async )?([0-9A-Za-z._-]+) \[as awaitable\]/);
        if (match && match[1]) {
          const sessionId = match[1];
          const fileName = `session-${sessionId.replace(/:/g, '-')}.json`;
          const sessionFile = join(sessionPath, fileName);
          if (fs.existsSync(sessionFile)) {
            fs.unlinkSync(sessionFile);
            logger.wa.info(`[SELF-HEAL] Removed corrupted session file: ${fileName}`);
          }
        }
      }
    } catch {
      // Ignore self-heal logging errors
    }
  };
}

// Simple in-memory CacheStore for msgRetryCounterCache
class SimpleCacheStore implements CacheStore {
  private cache = new Map<string, any>();

  get<T>(key: string): T | undefined {
    return this.cache.get(key);
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, value);
  }

  del(key: string): void {
    this.cache.delete(key);
  }

  flushAll(): void {
    this.cache.clear();
  }
}

const msgRetryCounterCache = new SimpleCacheStore();

// In-memory message cache for getMessage (retries)
const messageCache = new Map<string, any>();

// Set of message IDs sent automatically by this bot instance
const botSentMessageIds = new Set<string>();

export function markBotSentMessage(id: string | undefined | null): void {
  if (!id) return;
  botSentMessageIds.add(id);
  if (botSentMessageIds.size > 2000) {
    const oldestKey = botSentMessageIds.values().next().value;
    if (oldestKey) botSentMessageIds.delete(oldestKey);
  }
}

export function isBotSentMessage(id: string | undefined | null): boolean {
  if (!id) return false;
  return botSentMessageIds.has(id);
}

export function cacheMessage(id: string | undefined | null, message: any): void {
  if (!id || !message) return;
  messageCache.set(id, message);
  if (messageCache.size > 1000) {
    const oldestKey = messageCache.keys().next().value;
    if (oldestKey) messageCache.delete(oldestKey);
  }
}

export async function startClient(
  sessionPath: string,
  _logLevel?: string,
  onReady?: (sock: WASocket) => void,
): Promise<WASocket> {
  if (onReady) storedOnReady = onReady;
  isShuttingDown = false;
  setupSelfHealingSessionHandler(sessionPath);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  // Use 'warn' for Baileys internal logger to suppress protocol noise
  // (decrypt retries, receipts, etc). App-level logging uses LOG_LEVEL separately.
  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'warn' }),
    browser: ['QA Bot', 'Chrome', '1.0.0'],
    version: (await fetchLatestWaWebVersion({})).version,
    msgRetryCounterCache,
    getMessage: async (key) => {
      if (key.id && messageCache.has(key.id)) {
        return messageCache.get(key.id);
      }
      return undefined;
    },
  });

  const originalSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = (async (...args: Parameters<typeof originalSendMessage>) => {
    const result = await originalSendMessage(...args);
    if (result?.key?.id) {
      markBotSentMessage(result.key.id);
      cacheMessage(result.key.id, result.message);
      const [jid, content] = args as [string, any];
      const txt = content?.text || content?.caption || (content?.image ? '[Image]' : '');
      logger.wa.info(`[OUTGOING] To: ${jid} | Content: "${txt}" | ID: ${result.key.id}`);
    }
    return result;
  }) as typeof sock.sendMessage;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.wa.info('QR Code received. Scan with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      logger.wa.info('WhatsApp client is ready');
      if (storedOnReady && sock) storedOnReady(sock);
      connectionResolve?.();
    }

    if (connection === 'close') {
      if (isShuttingDown) {
        logger.wa.info('WhatsApp client connection closed (shutdown)');
        return;
      }

      const reason = (lastDisconnect?.error as any)?.output?.statusCode;
      console.dir(lastDisconnect, { depth: null });
      console.dir(update, { depth: null });

      if (reason !== DisconnectReason.loggedOut) {
        logger.wa.info('Reconnecting...');
        connectionPromise = new Promise((resolve) => {
          connectionResolve = resolve;
        });
        startClient(sessionPath);
      } else {
        logger.wa.error('Logged out. Delete session and re-scan QR.');
        process.exit(1);
      }
    }
  });

  connectionPromise = new Promise((resolve) => {
    connectionResolve = resolve;
  });

  return sock;
}

export function getSock(): WASocket {
  if (!sock) throw new Error('WhatsApp client not initialized');
  return sock;
}

export function waitForReady(): Promise<void> {
  return connectionPromise ?? Promise.reject('Client not started');
}

export async function destroyClient(): Promise<void> {
  isShuttingDown = true;
  if (sock) {
    sock.end(undefined);
    sock = null;
  }
}
