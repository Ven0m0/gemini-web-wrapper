export function wrapError(context: string, error: unknown): Error {
  return new Error('Failed to ' + context + ': ' + (error instanceof Error ? error.message : String(error)), { cause: error });
}
