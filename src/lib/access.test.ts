import { describe, expect, it } from "vitest";
import { isAuthPage, needsSignIn } from "./access";

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
