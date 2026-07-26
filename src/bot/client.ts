/**
 * WhatsApp client wrapper
 * Handles client initialization and authentication
 */

import wwebjs from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

const { Client, LocalAuth } = wwebjs;
type WAClient = InstanceType<typeof Client>;
import type { Config } from '../types/index.js';
import { logger } from '../utils/logger.js';

let client: WAClient | null = null;
let clientReady = false;
let readyResolve: (() => void) | null = null;

export function createClient(config: Config): WAClient {
  logger.wa.info('Creating WhatsApp client');
  clientReady = false;

  const waClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.whatsapp.sessionPath,
    }),
    puppeteer: {
      headless: false,
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  waClient.on('qr', (qr) => {
    logger.wa.info('QR Code received. Scan with WhatsApp:');
    qrcode.generate(qr, { small: true });
  });

  waClient.on('authenticated', () => {
    logger.wa.info('Client authenticated successfully');
  });

  waClient.on('auth_failure', (error) => {
    logger.wa.error('Authentication failed', error);
  });

  waClient.on('ready', () => {
    logger.wa.info('WhatsApp client is ready');
    clientReady = true;
    readyResolve?.();
  });

  waClient.on('disconnected', (reason) => {
    logger.wa.warn('Client disconnected', reason);
  });

  client = waClient;
  return waClient;
}

export function getClient(): WAClient {
  if (!client) {
    throw new Error('WhatsApp client not initialized. Call createClient first.');
  }
  return client;
}

export async function initializeClient(config: Config): Promise<void> {
  const waClient = createClient(config);
  logger.wa.info('Initializing WhatsApp client...');
  await waClient.initialize();
}

export function waitForReady(): Promise<void> {
  if (clientReady) return Promise.resolve();
  return new Promise((resolve) => {
    readyResolve = resolve;
  });
}

export async function destroyClient(): Promise<void> {
  if (client) {
    logger.wa.info('Destroying WhatsApp client');
    await client.destroy();
    client = null;
  }
}
