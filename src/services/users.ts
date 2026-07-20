/**
 * User service
 * Business logic for user management
 */

import { getOrCreateUser } from '../database/queries/users.js';
import type { User, Result } from '../types/index.js';
import { logger } from '../utils/logger.js';

export function ensureUser(whatsappId: string): Result<User, Error> {
  logger.db.debug(`Ensuring user exists: ${whatsappId}`);
  return getOrCreateUser(whatsappId);
}
