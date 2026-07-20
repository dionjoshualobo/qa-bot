/**
 * WhatsApp client wrapper
 * Handles client initialization and authentication
 */

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import type { Config } from '../types/index.js';
import { logger } from '../utils/logger.js';

let client: Client | null = null;

export function createClient(config: Config): Client {
  logger.wa.info('Creating WhatsApp client');

  const waClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.whatsapp.sessionPath,
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  // QR Code generation
  waClient.on('qr', (qr) => {
    logger.wa.info('QR Code received. Scan with WhatsApp:');
    qrcode.generate(qr, { small: true });
  });

  // Authentication events
  waClient.on('authenticated', () => {
    logger.wa.info('Client authenticated successfully');
  });

  waClient.on('auth_failure', (error) => {
    logger.wa.error('Authentication failed', error);
  });

  // Ready event
  waClient.on('ready', () => {
    logger.wa.info('WhatsApp client is ready');
  });

  // Disconnection event
  waClient.on('disconnected', (reason) => {
    logger.wa.warn('Client disconnected', reason);
  });

  client = waClient;
  return waClient;
}

export function getClient(): Client {
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

export async function destroyClient(): Promise<void> {
  if (client) {
    logger.wa.info('Destroying WhatsApp client');
    await client.destroy();
    client = null;
  }
}
