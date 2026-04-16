import { isAbsolute, join } from "node:path";
export function ensureAbsolutePath(path: string): { ok: true; path: string } | { ok: false; error: string } {
  if (isAbsolute(path)) return { ok: true, path };
  return { ok: false, error: `Path must be absolute: ${path}` };
}
export function ensureDirectoryPath(path: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return Bun.file(path).exists().then(exists => exists ? { ok: true } : { ok: false, error: `Directory does not exist: ${path}` });
}
export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars) + "\n... (truncated)", truncated: true };
}
