import { describe, expect, it } from "vitest";
import { RECEIPT_MAX_BYTES, fitWithin, freeSlotNo, receiptPath, sniffImageType } from "./receipts";

const bytes = (...n: number[]) => new Uint8Array(n);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toEqual({ mime: "image/png", ext: "png" });
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), 0))).toEqual({ mime: "image/webp", ext: "webp" });
  });

  it("refuses everything else, whatever the file is called (TC-025)", () => {
    expect(sniffImageType(bytes(...ascii("GIF89a"), 0, 0))).toBeNull();
    expect(sniffImageType(bytes(...ascii("%PDF-1.7")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("<svg xmlns=")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull(); // RIFF, but audio
    expect(sniffImageType(bytes())).toBeNull();
  });
});

describe("freeSlotNo", () => {
  it("hands out place 1, then 2, and reuses a place after a receipt is removed", () => {
    expect(freeSlotNo([])).toBe(1);
    expect(freeSlotNo([1])).toBe(2);
    expect(freeSlotNo([2])).toBe(1);
  });

  it("allows at most 2 per payment (TC-026)", () => {
    expect(freeSlotNo([1, 2])).toBeNull();
  });
});

describe("receiptPath", () => {
  it("is committee folder, payment folder, place number", () => {
    expect(receiptPath("c1", "p1", 2, "webp")).toBe("c1/p1/2.webp");
  });
});

describe("fitWithin", () => {
  it("shrinks the longest side to the limit and keeps the shape", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1200, 3600, 1600)).toEqual({ width: 533, height: 1600 });
  });

  it("never makes a small image bigger", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("limits", () => {
  it("the stored size limit is 2 MB", () => {
    expect(RECEIPT_MAX_BYTES).toBe(2_097_152);
  });
});
