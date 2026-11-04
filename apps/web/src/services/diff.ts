import * as Diff from 'diff';

export function formatDiffText(original: string, modified: string): string {
  return Diff.createPatch('file', original, modified, '', '');
}

export function hasChanges(original: string, modified: string): boolean {
  return original !== modified;
}
