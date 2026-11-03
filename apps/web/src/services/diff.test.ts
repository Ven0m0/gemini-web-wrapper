import { describe, expect, it } from 'vitest';
import { formatDiffText, generateDiff, hasChanges } from './diff';

describe('generateDiff', () => {
  it('marks identical text as unchanged', () => {
    expect(generateDiff('a\nb\n', 'a\nb\n').map((l) => l.type)).toEqual(['unchanged', 'unchanged']);
  });

  it('reports added and removed lines', () => {
    const lines = generateDiff('a\nb\n', 'a\nc\n');
    expect(lines.map((l) => [l.type, l.content])).toEqual([
      ['unchanged', 'a'],
      ['removed', 'b'],
      ['added', 'c'],
    ]);
  });

  it('numbers unchanged lines sequentially', () => {
    const lines = generateDiff('a\nb\n', 'a\nb\nc\n');
    expect(lines.filter((l) => l.type === 'unchanged').map((l) => l.lineNumber)).toEqual([1, 2]);
  });

  it('handles empty input', () => {
    expect(generateDiff('', '')).toEqual([]);
    expect(generateDiff('', 'x\n').map((l) => l.type)).toEqual(['added']);
  });
});

describe('hasChanges / formatDiffText', () => {
  it('detects changes', () => {
    expect(hasChanges('a', 'a')).toBe(false);
    expect(hasChanges('a', 'b')).toBe(true);
  });

  it('produces a patch containing the changed lines', () => {
    const patch = formatDiffText('a\n', 'b\n');
    expect(patch).toContain('-a');
    expect(patch).toContain('+b');
  });
});
