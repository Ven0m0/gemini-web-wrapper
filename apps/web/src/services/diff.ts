import * as Diff from 'diff'

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  lineNumber?: number
}

export function generateDiff(original: string, modified: string): DiffLine[] {
  const changes = Diff.diffLines(original, modified)
  const result: DiffLine[] = []
  let lineNumber = 1

  changes.forEach(change => {
    const lines = change.value.split('\n').filter(line => line !== '')

    lines.forEach(line => {
      if (change.added) {
        result.push({ type: 'added', content: line, lineNumber })
      } else if (change.removed) {
        result.push({ type: 'removed', content: line, lineNumber })
      } else {
        result.push({ type: 'unchanged', content: line, lineNumber })
        lineNumber++
      }
    })
  })

  return result
}

export function formatDiffText(original: string, modified: string): string {
  const diff = Diff.createPatch('file', original, modified, '', '')
  return diff
}

export function hasChanges(original: string, modified: string): boolean {
  return original !== modified
}
