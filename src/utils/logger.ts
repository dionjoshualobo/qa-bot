/**
 * Simple logging utility with module prefixes
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLogLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

function formatMessage(prefix: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${prefix}] ${message}`;
}

function log(level: LogLevel, prefix: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) {
    return;
  }

  const formattedMessage = formatMessage(prefix, message);

  switch (level) {
    case 'debug':
      console.debug(formattedMessage, data !== undefined ? data : '');
      break;
    case 'info':
      console.info(formattedMessage, data !== undefined ? data : '');
      break;
    case 'warn':
      console.warn(formattedMessage, data !== undefined ? data : '');
      break;
    case 'error':
      console.error(formattedMessage, data !== undefined ? data : '');
      break;
  }
}

export const logger = {
  db: {
    debug: (message: string, data?: unknown) => log('debug', 'DB', message, data),
    info: (message: string, data?: unknown) => log('info', 'DB', message, data),
    warn: (message: string, data?: unknown) => log('warn', 'DB', message, data),
    error: (message: string, data?: unknown) => log('error', 'DB', message, data),
  },
  wa: {
    debug: (message: string, data?: unknown) => log('debug', 'WA', message, data),
    info: (message: string, data?: unknown) => log('info', 'WA', message, data),
    warn: (message: string, data?: unknown) => log('warn', 'WA', message, data),
    error: (message: string, data?: unknown) => log('error', 'WA', message, data),
  },
  question: {
    debug: (message: string, data?: unknown) => log('debug', 'QUESTION', message, data),
    info: (message: string, data?: unknown) => log('info', 'QUESTION', message, data),
    warn: (message: string, data?: unknown) => log('warn', 'QUESTION', message, data),
    error: (message: string, data?: unknown) => log('error', 'QUESTION', message, data),
  },
  reply: {
    debug: (message: string, data?: unknown) => log('debug', 'REPLY', message, data),
    info: (message: string, data?: unknown) => log('info', 'REPLY', message, data),
    warn: (message: string, data?: unknown) => log('warn', 'REPLY', message, data),
    error: (message: string, data?: unknown) => log('error', 'REPLY', message, data),
  },
  mapping: {
    debug: (message: string, data?: unknown) => log('debug', 'MAPPING', message, data),
    info: (message: string, data?: unknown) => log('info', 'MAPPING', message, data),
    warn: (message: string, data?: unknown) => log('warn', 'MAPPING', message, data),
    error: (message: string, data?: unknown) => log('error', 'MAPPING', message, data),
  },
  bot: {
    debug: (message: string, data?: unknown) => log('debug', 'BOT', message, data),
    info: (message: string, data?: unknown) => log('info', 'BOT', message, data),
    warn: (message: string, data?: unknown) => log('warn', 'BOT', message, data),
    error: (message: string, data?: unknown) => log('error', 'BOT', message, data),
  },
};
