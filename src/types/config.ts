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
    groupId: string | null;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}
