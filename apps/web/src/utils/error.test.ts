import { describe, it, expect } from 'vitest';
import { errorMessage } from './error';

describe('errorMessage', () => {
  it('returns the message of an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns strings as-is', () => {
    expect(errorMessage('plain')).toBe('plain');
  });

  it('uses a string message field on plain objects', () => {
    expect(errorMessage({ message: 'from object' })).toBe('from object');
  });

  it('JSON-stringifies other objects', () => {
    expect(errorMessage({ foo: 'bar' })).toBe('{"foo":"bar"}');
  });

  it('falls back for circular objects', () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(errorMessage(o)).toBe('Unknown error');
  });

  it('falls back for null, undefined and empty values', () => {
    expect(errorMessage(null)).toBe('Unknown error');
    expect(errorMessage(undefined)).toBe('Unknown error');
    expect(errorMessage('')).toBe('Unknown error');
  });

  it('stringifies primitives', () => {
    expect(errorMessage(42)).toBe('42');
  });
});
