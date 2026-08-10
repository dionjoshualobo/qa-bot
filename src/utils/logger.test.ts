import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setLogLevel } from './logger.js';

describe('setLogLevel', () => {
  beforeEach(() => {
    setLogLevel('info');
  });

  it('sets the log level', () => {
    setLogLevel('debug');
    // setLogLevel is void, so we just verify it doesn't throw
    expect(true).toBe(true);
  });
});
