export function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
