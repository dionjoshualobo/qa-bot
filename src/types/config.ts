/**
 * Configuration types
 */

export interface Config {
  whatsapp: {
    sessionPath: string;
  };
  database: {
    path: string;
  };
  bot: {
    groupId: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}
