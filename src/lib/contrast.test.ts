import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for the same colour", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#14343B", "#14343B")).toBeCloseTo(1, 5);
  });

  it("does not depend on which colour is the text", () => {
    expect(contrastRatio("#FFFFFF", "#14343B")).toBeCloseTo(contrastRatio("#14343B", "#FFFFFF"), 10);
  });
});

// Reads the real design tokens from globals.css, so the check can never drift from what ships.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const token = (name: string): string => {
  const match = css.match(new RegExp(String.raw`--${name}:\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`Token --${name} not found in globals.css`);
  return match[1];
};

// [text, background, what it is used for]. Body text needs 4.5:1 (WCAG AA).
const pairs: [string, string, string][] = [
  ["ink", "ground", "body text on the page"],
  ["ink", "paper", "body text on cards"],
  ["ink2", "ground", "secondary text on the page"],
  ["ink2", "paper", "secondary text on cards"],
  ["ink2", "wash", "table headings"],
  ["tealink", "ground", "links on the page"],
  ["tealink", "paper", "links on cards"],
  ["tealink", "paidbg", "paid chip"],
  ["late", "latebg", "late chip and late note"],
  ["late", "paper", "late text on cards"],
  ["paper", "ink", "primary button text"],
  ["railtx", "rail", "side rail links"],
  ["railtx2", "rail", "side rail group labels"],
  ["paper", "rail", "phone top bar text"],
  ["ink", "lit1", "highlighted row, left end"],
  ["ink", "lit2", "highlighted row, right end"],
];

describe("design token contrast (WCAG AA, TC-104)", () => {
  for (const [text, background, use] of pairs) {
    it(`${text} on ${background} (${use}) is at least 4.5:1`, () => {
      expect(contrastRatio(token(text), token(background))).toBeGreaterThanOrEqual(4.5);
    });
  }
});
