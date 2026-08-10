/**
 * WhatsApp client wrapper using Baileys
 */

import {
  makeWASocket,
  fetchLatestWaWebVersion,
  useMultiFileAuthState,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { logger } from '../utils/logger.js';

let sock: WASocket | null = null;
let connectionPromise: Promise<void> | null = null;
let connectionResolve: (() => void) | null = null;

export async function startClient(sessionPath: string): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['QA Bot', 'Chrome', '1.0.0'],
    version: (await fetchLatestWaWebVersion({})).version,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.wa.info('QR Code received. Scan with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      logger.wa.info('WhatsApp client is ready');
      connectionResolve?.();
    }

    if (connection === 'close') {
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
  if (sock) {
    sock.end(undefined);
    sock = null;
  }
}
