export function okToolResult(summary: string, data?: unknown) {
  return { ok: true, summary, data };
}
export function errorToolResult(error: string, code?: string, details?: Record<string, unknown>) {
  return { ok: false, summary: error, error, code, details };
}
