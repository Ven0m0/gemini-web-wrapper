import { describe, expect, it } from 'vitest';
import { normalizeString } from './string';

describe('normalizeString', () => {
  it('should trim regular strings', () => {
    expect(normalizeString('  hello world  ')).toBe('hello world');
    expect(normalizeString('test')).toBe('test');
    expect(normalizeString('   ')).toBe('');
    expect(normalizeString('')).toBe('');
  });

  it('should handle non-string inputs by returning an empty string', () => {
    expect(normalizeString(null)).toBe('');
    expect(normalizeString(undefined)).toBe('');
    expect(normalizeString(123)).toBe('');
    expect(normalizeString(true)).toBe('');
    expect(normalizeString(false)).toBe('');
    expect(normalizeString({ key: 'value' })).toBe('');
    expect(normalizeString(['array'])).toBe('');
    expect(normalizeString(() => {})).toBe('');
  });
});
