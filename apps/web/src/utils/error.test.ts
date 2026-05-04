import { describe, it, expect } from 'vitest';
import { wrapError } from './error';

describe('wrapError', () => {
  it('should wrap an Error instance correctly', () => {
    const originalError = new Error('Original error message');
    const wrappedError = wrapError('do something', originalError);

    expect(wrappedError).toBeInstanceOf(Error);
    expect(wrappedError.message).toBe('Failed to do something: Original error message');
    expect(wrappedError.cause).toBe(originalError);
  });

  it('should wrap a string correctly', () => {
    const originalError = 'String error message';
    const wrappedError = wrapError('do something', originalError);

    expect(wrappedError).toBeInstanceOf(Error);
    expect(wrappedError.message).toBe('Failed to do something: String error message');
    expect(wrappedError.cause).toBe(originalError);
  });

  it('should wrap an object correctly', () => {
    const originalError = { foo: 'bar' };
    const wrappedError = wrapError('do something', originalError);

    expect(wrappedError).toBeInstanceOf(Error);
    expect(wrappedError.message).toBe('Failed to do something: [object Object]');
    expect(wrappedError.cause).toBe(originalError);
  });

  it('should wrap null correctly', () => {
    const originalError = null;
    const wrappedError = wrapError('do something', originalError);

    expect(wrappedError).toBeInstanceOf(Error);
    expect(wrappedError.message).toBe('Failed to do something: null');
    expect(wrappedError.cause).toBe(originalError);
  });

  it('should wrap undefined correctly', () => {
    const originalError = undefined;
    const wrappedError = wrapError('do something', originalError);

    expect(wrappedError).toBeInstanceOf(Error);
    expect(wrappedError.message).toBe('Failed to do something: undefined');
    expect(wrappedError.cause).toBe(originalError);
  });
});
