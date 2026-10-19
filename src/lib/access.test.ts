import { describe, expect, it } from "vitest";
import { isAuthPage, needsSignIn, safeNext } from "./access";

describe("needsSignIn", () => {
  it("protects the committees pages and everything under them", () => {
    expect(needsSignIn("/committees")).toBe(true);
    expect(needsSignIn("/committees/new")).toBe(true);
    expect(needsSignIn("/committees/abc/payments")).toBe(true);
  });

  it("leaves public pages open", () => {
    for (const path of ["/", "/sign-in", "/sign-up", "/how-its-built", "/icon.svg"]) {
      expect(needsSignIn(path), path).toBe(false);
    }
  });

  it("does not mistake a longer word for a protected page", () => {
    expect(needsSignIn("/committeesfoo")).toBe(false);
  });
});

describe("isAuthPage", () => {
  it("recognises sign-in and sign-up", () => {
    expect(isAuthPage("/sign-in")).toBe(true);
    expect(isAuthPage("/sign-up")).toBe(true);
  });

  it("is false for everything else", () => {
    expect(isAuthPage("/")).toBe(false);
    expect(isAuthPage("/committees")).toBe(false);
    expect(isAuthPage("/sign-inn")).toBe(false);
  });
});

describe("safeNext", () => {
  const token = "A".repeat(43);
  it("allows only a member page or the member home", () => {
    expect(safeNext(`/m/${token}`)).toBe(`/m/${token}`);
    expect(safeNext("/me")).toBe("/me");
    expect(safeNext("/me/0d3b7f0e-1111-4222-8333-444455556666")).toBe("/me/0d3b7f0e-1111-4222-8333-444455556666");
  });
  it("refuses anything else, including other sites and organiser pages", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/committees", "/m/short", `/m/${token}/receipt/x/1`, "/me/../committees", "", null, undefined, 5]) expect(safeNext(bad)).toBeNull();
  });
  it("now treats /me as needing a sign-in", () => {
    expect(needsSignIn("/me")).toBe(true);
    expect(needsSignIn("/me/abc")).toBe(true);
    expect(needsSignIn("/m/abc")).toBe(false);
  });
});
