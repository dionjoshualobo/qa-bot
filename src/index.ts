/**
 * Main entry point for the QA Bot
 */

import 'dotenv/config';
import { loadConfig } from './config/index.js';
import { initDatabase, closeDatabase } from './database/database.js';
import { initializeClient, getClient, destroyClient, waitForReady } from './bot/client.js';
import { registerEventHandlers } from './bot/events.js';
import { logger, setLogLevel } from './utils/logger.js';

async function discoverGroups(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logging.level);

  logger.bot.info('GROUP_ID not set — running in discovery mode');

  await initializeClient(config);
  await waitForReady();

  // Give WhatsApp Web a moment to settle after ready
  await new Promise((r) => setTimeout(r, 3000));

  const client = getClient();
  const page = (client as any).pupPage;

  let groups: { name: string; id: string }[] = [];
  try {
    groups = await page.evaluate(() => {
      // @ts-expect-error running in browser context via puppeteer
      const chats = window.require('WAWebCollections').Chat.getModelsArray();
      return chats
        .filter((c: any) => {
          const id: string = c.id?._serialized || '';
          return id.endsWith('@g.us');
        })
        .map((c: any) => ({
          name: c.formattedTitle || c.name || 'Unknown',
          id: c.id._serialized,
        }));
    });
  } catch (err) {
    logger.bot.error('Failed to query group list from WhatsApp Web', err);
    await destroyClient();
    process.exit(1);
  }

  if (groups.length === 0) {
    logger.bot.info('No groups found. Make sure you are a member of at least one group.');
  } else {
    logger.bot.info(`Found ${groups.length} group(s):\n`);
    console.log('─'.repeat(60));
    for (const group of groups) {
      console.log(`Name: ${group.name}`);
      console.log(`ID:   ${group.id}`);
      console.log('─'.repeat(60));
    }
    console.log('\nCopy the Group ID into your .env file:');
    console.log('GROUP_ID=<paste-id-here>\n');
  }

  await destroyClient();
  process.exit(0);
}

async function main(): Promise<void> {
  try {
    logger.bot.info('Starting QA Bot...');

    // Load configuration
    const config = loadConfig();
    setLogLevel(config.logging.level);
    logger.bot.info('Configuration loaded');

    // Discovery mode: list groups and exit
    if (config.bot.groupId === null) {
      await discoverGroups();
      return;
    }

    // Initialize database
    const dbResult = initDatabase(config.database.path);
    if (!dbResult.success) {
      logger.bot.error('Failed to initialize database', dbResult.error);
      process.exit(1);
    }
    logger.bot.info('Database initialized');

    // Initialize WhatsApp client
    await initializeClient(config);
    const client = getClient();

    // Register event handlers
    registerEventHandlers(client, config);

    logger.bot.info('QA Bot is running');
  } catch (error) {
    logger.bot.error('Fatal error during startup', error);
    process.exit(1);
  }
}

// Graceful shutdown
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

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.bot.error('Uncaught exception', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.bot.error('Unhandled rejection', reason);
  shutdown('unhandledRejection');
});

// Start the bot
main();