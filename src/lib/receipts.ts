// Receipt images (rules P4, P5): what is allowed, and the small checks both the phone and the server make.
// Pure functions: no database, no storage. The server route and the database enforce the same limits again.

/** Most images a single payment can have. */
export const RECEIPTS_PER_PAYMENT = 2;
/** Largest stored image: 2 MB (decision 4). The phone shrinks a photo to fit; the server and the database refuse anything bigger. */
export const RECEIPT_MAX_BYTES = 2 * 1024 * 1024;
/** The longest side a shrunk image keeps, in pixels: enough to read a transaction number. */
export const RECEIPT_MAX_EDGE = 1600;

export type ReceiptType = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/**
 * Which image type a file really is, from its first bytes. The browser's own claim ("this is a PNG") is not trusted:
 * a renamed file would carry the wrong label. Null for anything that is not a JPEG, PNG or WebP.
 */
export function sniffImageType(bytes: Uint8Array): ReceiptType | null {
  const at = (i: number) => bytes[i] ?? -1;
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) {
    return { mime: "image/png", ext: "png" };
  }
  // WebP is "RIFF", four size bytes, then "WEBP".
  const text = (from: number, to: number) => String.fromCharCode(...Array.from(bytes.slice(from, to)));
  if (bytes.length >= 12 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

/** The first free place (1 or 2) among the places already taken by a payment's receipts; null when both are taken. */
export function freeSlotNo(taken: number[]): 1 | 2 | null {
  if (!taken.includes(1)) return 1;
  if (!taken.includes(2)) return 2;
  return null;
}

/** Where a receipt's file lives. The database checks the folder is this committee's and this payment's own. */
export function receiptPath(committeeId: string, paymentId: string, slotNo: number, ext: string): string {
  return `${committeeId}/${paymentId}/${slotNo}.${ext}`;
}

/** The size an image shrinks to so its longest side is at most `maxEdge`, keeping its shape. Never makes it larger. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
