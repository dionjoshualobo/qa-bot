/**
 * Main entry point for the QA Bot
 */

import 'dotenv/config';
import { loadConfig } from './config/index.js';
import { initDatabase, closeDatabase } from './database/database.js';
import { startClient, destroyClient } from './bot/client.js';
import { registerEventHandlers } from './bot/events.js';
import { logger, setLogLevel } from './utils/logger.js';

async function main(): Promise<void> {
  try {
    logger.bot.info('Starting QA Bot...');

    const config = loadConfig();
    setLogLevel(config.logging.level);
    logger.bot.info('Configuration loaded');

    if (!config.bot.groupId) {
      logger.bot.error('GROUP_ID is required. Set it in .env');
      process.exit(1);
    }

    const dbResult = initDatabase(config.database.path);
    if (!dbResult.success) {
      logger.bot.error('Failed to initialize database', dbResult.error);
      process.exit(1);
    }
    logger.bot.info('Database initialized');

    const sock = await startClient(config.whatsapp.sessionPath);
    registerEventHandlers(sock, config);

    logger.bot.info('QA Bot is running');
  } catch (error) {
    logger.bot.error('Fatal error during startup', error);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.bot.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await destroyClient();
    closeDatabase();
    logger.bot.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.bot.error('Error during shutdown', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (error) => {
  logger.bot.error('Uncaught exception', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.bot.error('Unhandled rejection', reason);
  shutdown('unhandledRejection');
});

main();
