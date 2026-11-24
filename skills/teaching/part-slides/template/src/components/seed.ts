/** FNV-1a over the key's UTF-8 bytes, as a rough.js seed in 1..2^31-1: one id always draws the same way. */
export function seedOf(key: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(key)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 0x7fffffff || 1;
}
