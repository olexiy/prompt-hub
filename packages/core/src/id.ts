/**
 * UUIDv7 (RFC 9562): 48-bit Unix milliseconds, then random bits. Ids sort by creation time,
 * which keeps B-tree indexes compact, and are generated in the app so the database
 * version does not matter (Postgres gets `uuidv7()` only from version 18).
 */
export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let ms = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f); // version 7
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f); // RFC 9562 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Milliseconds timestamp encoded in a UUIDv7. */
export function uuidv7Time(id: string): number {
  return parseInt(id.replace(/-/g, "").slice(0, 12), 16);
}
