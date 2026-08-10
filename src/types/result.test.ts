import { describe, it, expect } from 'vitest';
import { ok, err, unwrap, unwrapOr } from './result.js';

describe('ok', () => {
  it('creates a success result', () => {
    const result = ok(42);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(42);
    }
  });
});

describe('err', () => {
  it('creates an error result', () => {
    const result = err('fail');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('fail');
    }
  });
});

describe('unwrap', () => {
  it('returns data from success', () => {
    expect(unwrap(ok('hello'))).toBe('hello');
  });

  it('throws error from err', () => {
    expect(() => unwrap(err('oops'))).toThrow('oops');
  });
});

describe('unwrapOr', () => {
  it('returns data from success', () => {
    expect(unwrapOr(ok('yes'), 'default')).toBe('yes');
  });

  it('returns default from err', () => {
    expect(unwrapOr(err('no'), 'default')).toBe('default');
  });
});
