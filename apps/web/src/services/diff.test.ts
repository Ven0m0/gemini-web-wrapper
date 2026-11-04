import { describe, expect, it } from 'vitest';
import { formatDiffText, hasChanges } from './diff';

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
