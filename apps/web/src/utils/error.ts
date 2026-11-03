export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message || 'Unknown error';
  if (typeof e === 'string') return e || 'Unknown error';
  if (e === null || e === undefined) return 'Unknown error';
  if (typeof e === 'object') {
    const message = (e as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
    try {
      return JSON.stringify(e) ?? 'Unknown error';
    } catch {
      return 'Unknown error';
    }
  }
  return String(e);
}
