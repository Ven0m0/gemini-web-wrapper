export const NIBBLE = 'ZPMQVRWSNKTXJBYH';

export const DICT = Array.from({ length: 256 }, (_, i) => `${NIBBLE[i >>> 4]}${NIBBLE[i & 0x0f]}`);

export const RE_SIGNIFICANT = /[\p{L}\p{N}]/u;

export const HASH_REF = /^([0-9]+)#([ZPMQVRWSNKTXJBYH]{2})$/;

export function computeHash(lineNum: number, content: string): string {
  const text = content.replace(/\r/g, '').trimEnd();
  const seed = RE_SIGNIFICANT.test(text) ? 0 : lineNum;
  return DICT[Bun.hash.xxHash32(text, seed) % 256];
}

export function computeLegacyHash(lineNum: number, content: string): string {
  const text = content.replace(/\r/g, '').replace(/\s+/g, '');
  const seed = RE_SIGNIFICANT.test(text) ? 0 : lineNum;
  return DICT[Bun.hash.xxHash32(text, seed) % 256];
}

export function formatHashLines(content: string, startLine = 1): string {
  if (!content) return '';
  return content
    .split('\n')
    .map((line, i) => `${startLine + i}#${computeHash(startLine + i, line)}|${line}`)
    .join('\n');
}

export function normalizeRef(ref: string): string {
  let s = ref.trim();
  s = s.replace(/^(?:>>>|[+-])\s*/, '');
  s = s.replace(/\s*#\s*/, '#');
  s = s.replace(/\|.*$/, '').trim();
  if (HASH_REF.test(s)) return s;
  const m = s.match(/([0-9]+#[ZPMQVRWSNKTXJBYH]{2})/);
  return m ? m[1] : ref.trim();
}

export function parseRef(ref: string): { line: number; hash: string } {
  const n = normalizeRef(ref);
  const m = n.match(HASH_REF);
  if (m) return { line: parseInt(m[1], 10), hash: m[2] };

  const hIdx = n.indexOf('#');
  if (hIdx > 0) {
    const pre = n.slice(0, hIdx);
    const suf = n.slice(hIdx + 1);
    if (!/^\d+$/.test(pre) && /^[ZPMQVRWSNKTXJBYH]{2}$/.test(suf)) {
      throw new Error(`"${pre}" is not a line number in ref "${ref}"`);
    }
  }
  throw new Error(`Invalid line ref "${ref}" — expected {line}#{hash}`);
}

export function validateHash(lineNum: number, content: string, expectedHash: string): boolean {
  return computeHash(lineNum, content) === expectedHash || computeLegacyHash(lineNum, content) === expectedHash;
}
