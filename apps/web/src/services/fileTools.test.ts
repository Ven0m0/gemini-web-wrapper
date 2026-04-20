import { describe, expect, it } from 'vitest';
import { applyLineRangeEdit } from './fileTools';

describe('applyLineRangeEdit', () => {
  const content = 'line1\nline2\nline3\nline4\nline5';

  describe('happy paths', () => {
    it('replaces multiple lines', () => {
      const result = applyLineRangeEdit(content, 2, 4, 'new2\nnew3\nnew4');
      expect(result).toBe('line1\nnew2\nnew3\nnew4\nline5');
    });

    it('replaces a single line', () => {
      const result = applyLineRangeEdit(content, 3, 3, 'new3');
      expect(result).toBe('line1\nline2\nnew3\nline4\nline5');
    });

    it('inserts lines between existing lines', () => {
      const result = applyLineRangeEdit(content, 3, 2, 'inserted1\ninserted2');
      expect(result).toBe('line1\nline2\ninserted1\ninserted2\nline3\nline4\nline5');
    });

    it('prepends to the file', () => {
      const result = applyLineRangeEdit(content, 1, 0, 'new0');
      expect(result).toBe('new0\nline1\nline2\nline3\nline4\nline5');
    });

    it('appends to the file', () => {
      const result = applyLineRangeEdit(content, 6, 5, 'new6');
      expect(result).toBe('line1\nline2\nline3\nline4\nline5\nnew6');
    });

    it('deletes lines', () => {
      const result = applyLineRangeEdit(content, 2, 4, '');
      expect(result).toBe('line1\nline5');
    });
  });

  describe('error cases', () => {
    it('throws when startLine < 1', () => {
      expect(() => applyLineRangeEdit(content, 0, 1, 'text')).toThrowError('Line numbers must be positive');
    });

    it('throws when endLine < 0', () => {
      expect(() => applyLineRangeEdit(content, 1, -1, 'text')).toThrowError('Line numbers must be positive');
    });

    it('throws when startLine > endLine + 1', () => {
      expect(() => applyLineRangeEdit(content, 4, 2, 'text')).toThrowError('start_line (4) must be <= end_line + 1 (3)');
    });

    it('throws when startLine exceeds file length + 1', () => {
      expect(() => applyLineRangeEdit(content, 7, 6, 'text')).toThrowError('start_line 7 exceeds file length (5 lines)');
    });

    it('throws when endLine exceeds file length', () => {
      expect(() => applyLineRangeEdit(content, 2, 6, 'text')).toThrowError('end_line 6 exceeds file length (5 lines)');
    });
  });
});
