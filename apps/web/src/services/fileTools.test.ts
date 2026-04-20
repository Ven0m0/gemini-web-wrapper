import { describe, expect, it } from 'vitest';
import { applyLineRangeEdit } from './fileTools';

describe('applyLineRangeEdit', () => {
  const content = 'line1\nline2\nline3\nline4\nline5';

  it('replaces a single line', () => {
    const result = applyLineRangeEdit(content, 2, 2, 'new_line2');
    expect(result).toBe('line1\nnew_line2\nline3\nline4\nline5');
  });

  it('replaces multiple lines', () => {
    const result = applyLineRangeEdit(content, 2, 4, 'new_line2_to_4');
    expect(result).toBe('line1\nnew_line2_to_4\nline5');
  });

  it('inserts lines without replacing (startLine = endLine + 1)', () => {
    const result = applyLineRangeEdit(content, 3, 2, 'inserted_line');
    expect(result).toBe('line1\nline2\ninserted_line\nline3\nline4\nline5');
  });

  it('deletes lines when newCode is empty string', () => {
    const result = applyLineRangeEdit(content, 2, 4, '');
    expect(result).toBe('line1\nline5');
  });

  it('handles modifications at the beginning of the file', () => {
    const result = applyLineRangeEdit(content, 1, 2, 'start_mod');
    expect(result).toBe('start_mod\nline3\nline4\nline5');
  });

  it('handles modifications at the end of the file', () => {
    const result = applyLineRangeEdit(content, 4, 5, 'end_mod');
    expect(result).toBe('line1\nline2\nline3\nend_mod');
  });

  it('handles appending at the end of the file', () => {
    const result = applyLineRangeEdit(content, 6, 5, 'appended_line');
    expect(result).toBe('line1\nline2\nline3\nline4\nline5\nappended_line');
  });

  it('handles inserting at the beginning of the file', () => {
    const result = applyLineRangeEdit(content, 1, 0, 'prepended_line');
    expect(result).toBe('prepended_line\nline1\nline2\nline3\nline4\nline5');
  });

  it('throws error if startLine < 1', () => {
    expect(() => applyLineRangeEdit(content, 0, 2, 'foo')).toThrow('Line numbers must be positive');
  });

  it('throws error if endLine < 0', () => {
    expect(() => applyLineRangeEdit(content, 1, -1, 'foo')).toThrow('Line numbers must be positive');
  });

  it('throws error if startLine > endLine + 1', () => {
    expect(() => applyLineRangeEdit(content, 4, 2, 'foo')).toThrow('start_line (4) must be <= end_line + 1 (3)');
  });

  it('throws error if startLine > lines.length + 1', () => {
    expect(() => applyLineRangeEdit(content, 7, 6, 'foo')).toThrow('start_line 7 exceeds file length (5 lines)');
  });

  it('throws error if endLine > lines.length', () => {
    expect(() => applyLineRangeEdit(content, 2, 6, 'foo')).toThrow('end_line 6 exceeds file length (5 lines)');
  });
});
