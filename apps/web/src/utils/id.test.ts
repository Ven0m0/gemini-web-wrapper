import { describe, expect, it } from 'vitest';
import { generateId } from './id';

describe('generateId', () => {
  it('should generate a valid UUID', () => {
    const id = generateId();
    // UUID v4 format regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });

  it('should generate unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const id = generateId();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
    expect(ids.size).toBe(100);
  });
});
