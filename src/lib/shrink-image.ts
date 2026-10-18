// Runs in the browser only: shrinks a photo so it fits the 2 MB receipt limit (rule P4) before it is uploaded.
import { RECEIPT_MAX_BYTES, RECEIPT_MAX_EDGE, fitWithin } from "./receipts";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** A short message when the browser cannot use this file, or null when it can. Checked before any shrinking. */
export function imageProblem(file: File): string | null {
  if (!TYPES.includes(file.type)) return "Only JPEG, PNG or WebP images can be attached. A screenshot works; a PDF or a HEIC photo doesn’t.";
  return null;
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

/**
 * Redraws the image at most RECEIPT_MAX_EDGE pixels on its longest side and saves it as WebP (or JPEG), lowering the quality
 * (then the size) until it is 2 MB or less. A small image that is already under the limit is still re-saved, which also
 * drops the location and camera details that a phone photo carries.
 */
export async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  let edge = RECEIPT_MAX_EDGE;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, edge);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    // WebP is smallest; a browser that cannot write WebP (it hands back a PNG instead) falls through to JPEG.
    for (const mime of ["image/webp", "image/jpeg"]) {
      for (const quality of [0.85, 0.7, 0.55]) {
        const blob = await toBlob(canvas, mime, quality);
        if (blob && blob.type === mime && blob.size <= RECEIPT_MAX_BYTES) {
          bitmap.close();
          return new File([blob], mime === "image/webp" ? "receipt.webp" : "receipt.jpg", { type: mime });
        }
      }
    }
    edge = Math.round(edge * 0.75);
  }
  bitmap.close();
  throw new Error("That image couldn’t be shrunk to 2 MB. Try a smaller one.");
}
