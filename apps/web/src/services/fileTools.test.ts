import { describe, expect, it } from 'vitest';
import { applyLineRangeEdit } from './fileTools';

describe('fileTools', () => {
  describe('applyLineRangeEdit', () => {
    const content = 'line 1\nline 2\nline 3\nline 4\nline 5';

    it('should replace a single line', () => {
      const result = applyLineRangeEdit(content, 3, 3, 'new line 3');
      expect(result).toBe('line 1\nline 2\nnew line 3\nline 4\nline 5');
    });

    it('should replace multiple lines', () => {
      const result = applyLineRangeEdit(content, 2, 4, 'new block');
      expect(result).toBe('line 1\nnew block\nline 5');
    });

    it('should insert text at a specific position (startLine = endLine + 1)', () => {
      const result = applyLineRangeEdit(content, 3, 2, 'inserted line');
      expect(result).toBe('line 1\nline 2\ninserted line\nline 3\nline 4\nline 5');
    });

    it('should delete lines by providing an empty newCode', () => {
      const result = applyLineRangeEdit(content, 2, 4, '');
      // When newCode is empty, the replacement is empty array, so lines are removed.
      expect(result).toBe('line 1\nline 5');
    });

    it('should throw an error for negative or zero startLine', () => {
      expect(() => applyLineRangeEdit(content, 0, 1, 'text')).toThrow('Line numbers must be positive');
      expect(() => applyLineRangeEdit(content, -1, 1, 'text')).toThrow('Line numbers must be positive');
    });

    it('should throw an error for negative endLine', () => {
      expect(() => applyLineRangeEdit(content, 1, -1, 'text')).toThrow('Line numbers must be positive');
    });

    it('should throw an error if startLine > endLine + 1', () => {
      expect(() => applyLineRangeEdit(content, 4, 2, 'text')).toThrow('start_line (4) must be <= end_line + 1 (3)');
    });

    it('should throw an error if startLine exceeds file length + 1', () => {
      expect(() => applyLineRangeEdit(content, 7, 7, 'text')).toThrow('start_line 7 exceeds file length (5 lines)');
    });

    it('should throw an error if endLine exceeds file length', () => {
      expect(() => applyLineRangeEdit(content, 5, 6, 'text')).toThrow('end_line 6 exceeds file length (5 lines)');
    });

    it('should support replacing the first line', () => {
      const result = applyLineRangeEdit(content, 1, 1, 'new line 1');
      expect(result).toBe('new line 1\nline 2\nline 3\nline 4\nline 5');
    });

    it('should support replacing the last line', () => {
      const result = applyLineRangeEdit(content, 5, 5, 'new line 5');
      expect(result).toBe('line 1\nline 2\nline 3\nline 4\nnew line 5');
    });

    it('should support appending to the end of the file', () => {
      const result = applyLineRangeEdit(content, 6, 5, 'new line 6');
      expect(result).toBe('line 1\nline 2\nline 3\nline 4\nline 5\nnew line 6');
    });
  });
});
