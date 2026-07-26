/**
 * Configuration management
 * Loads and validates configuration from environment variables
 */

import type { Config } from '../types/index.js';

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
  const level = getEnvVar('LOG_LEVEL', 'info').toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }
  return 'info';
}

export function loadConfig(): Config {
  return {
    whatsapp: {
      sessionPath: getEnvVar('SESSION_PATH', './.wwebjs_auth'),
    },
    database: {
      path: getEnvVar('DATABASE_PATH', './qa-bot.db'),
    },
    bot: {
      groupId: process.env['GROUP_ID'] || null,
    },
    logging: {
      level: getLogLevel(),
    },
  };
}
