import { healJSON } from '../utils/jsonHealer'

const NIBBLE = 'ZPMQVRWSNKTXJBYH'
const DICT = Array.from({ length: 256 }, (_, i) => `${NIBBLE[i >>> 4]}${NIBBLE[i & 0x0f]}`)
const RE_SIGNIFICANT = /[\p{L}\p{N}]/u

function hash32(text: string, seed = 0): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

export function computeLineHash(lineNumber: number, content: string): string {
  const text = content.replace(/\r/g, '').trimEnd()
  const seed = RE_SIGNIFICANT.test(text) ? 0 : lineNumber
  return DICT[hash32(text, seed) % 256]
}

export function formatAnnotatedLines(content: string, startLine = 1): string {
  if (!content) return ''
  return content
    .split('\n')
    .map((line, index) => `${startLine + index}#${computeLineHash(startLine + index, line)}|${line}`)
    .join('\n')
}

export function readAnnotatedContent(content: string, offset = 1, limit = 2000): string {
  const allLines = content.split('\n')
  const total = allLines.length
  const safeOffset = Math.max(1, offset)
  const safeLimit = Math.max(1, limit)
  const startIndex = safeOffset - 1
  const lines = allLines.slice(startIndex, startIndex + safeLimit)
  const annotated = formatAnnotatedLines(lines.join('\n'), safeOffset)
  const endLine = startIndex + lines.length
  return total > safeLimit || safeOffset > 1
    ? `(lines ${safeOffset}-${endLine} of ${total})\n${annotated}`
    : annotated
}

function parseSearchPattern(input: string): RegExp {
  const trimmed = input.trim()

  try {
    const slashMatch = trimmed.match(/^\/(.*)\/([a-z]*)$/)
    if (slashMatch) {
      return new RegExp(slashMatch[1], slashMatch[2])
    }
    return new RegExp(trimmed, 'i')
  } catch {
    throw new Error(`Invalid regex pattern: ${input}`)
  }
}

export function searchAnnotatedContent(content: string, pattern: string, context = 2): string {
  const regex = parseSearchPattern(pattern)
  const lines = content.split('\n')
  const matchIndexes = lines.flatMap((line, index) => {
    if (regex.global || regex.sticky) {
      regex.lastIndex = 0
    }
    return regex.test(line) ? [index] : []
  })

  if (matchIndexes.length === 0) {
    return `No matches found for: ${pattern}`
  }

  const included = new Set<number>()
  matchIndexes.forEach((index) => {
    for (let current = Math.max(0, index - context); current <= Math.min(lines.length - 1, index + context); current += 1) {
      included.add(current)
    }
  })

  const matchSet = new Set(matchIndexes)
  const ordered = [...included].sort((a, b) => a - b)
  const output: string[] = []
  let previous = -1

  for (const index of ordered) {
    if (previous !== -1 && index > previous + 1) {
      output.push('    ...')
    }
    const lineNumber = index + 1
    const annotated = `${lineNumber}#${computeLineHash(lineNumber, lines[index])}|${lines[index]}`
    output.push(matchSet.has(index) ? `> ${annotated}` : `  ${annotated}`)
    previous = index
  }

  return output.join('\n')
}

export function applyLineRangeEdit(content: string, startLine: number, endLine: number, newCode: string): string {
  const lines = content.split('\n')

  if (startLine < 1 || endLine < 0) {
    throw new Error('Line numbers must be positive')
  }

  if (startLine > endLine + 1) {
    throw new Error(`start_line (${startLine}) must be <= end_line + 1 (${endLine + 1})`)
  }

  if (startLine > lines.length + 1) {
    throw new Error(`start_line ${startLine} exceeds file length (${lines.length} lines)`)
  }

  if (endLine > lines.length) {
    throw new Error(`end_line ${endLine} exceeds file length (${lines.length} lines)`)
  }

  const before = lines.slice(0, startLine - 1)
  const after = startLine <= endLine ? lines.slice(endLine) : lines.slice(startLine - 1)
  const replacement = newCode ? [newCode] : []
  return [...before, ...replacement, ...after].join('\n')
}

export function repairJsonContent(content: string): { content: string; warnings: string[] } {
  const healed = healJSON<unknown>(content)
  if (!healed.success || healed.data === undefined) {
    throw new Error(healed.errors?.join(', ') || 'Failed to repair JSON')
  }

  return {
    content: JSON.stringify(healed.data, null, 2),
    warnings: healed.warnings || [],
  }
}

export function isJsonPath(path: string): boolean {
  return /\.json$/i.test(path.trim())
}

const TEXT_PATH_EXTENSIONS = new Set([
  'c',
  'cc',
  'cpp',
  'css',
  'csv',
  'gitignore',
  'go',
  'html',
  'java',
  'js',
  'json',
  'jsx',
  'md',
  'mjs',
  'py',
  'rb',
  'rs',
  'sh',
  'sql',
  'svg',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
])

const TEXT_MIME_TYPES = new Set([
  'application/javascript',
  'application/json',
  'application/ld+json',
  'application/sql',
  'application/typescript',
  'application/x-httpd-php',
  'application/x-sh',
  'application/xhtml+xml',
  'application/xml',
  'image/svg+xml',
  'text/csv',
  'text/html',
  'text/javascript',
  'text/markdown',
  'text/plain',
  'text/xml',
])

export function isTextPath(path: string, mimeType = ''): boolean {
  const normalizedMimeType = mimeType.trim().toLowerCase()
  if (normalizedMimeType.startsWith('text/')) {
    return true
  }

  if (TEXT_MIME_TYPES.has(normalizedMimeType)) {
    return true
  }

  const normalizedPath = path.trim().toLowerCase()
  if (!normalizedPath) {
    return false
  }

  const filename = normalizedPath.split('/').pop() || normalizedPath
  if (!filename.includes('.')) {
    return TEXT_PATH_EXTENSIONS.has(filename)
  }

  const extension = filename.split('.').pop()
  return extension ? TEXT_PATH_EXTENSIONS.has(extension) : false
}
