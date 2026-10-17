import { describe, expect, it } from "vitest";
import { validateCredentials } from "./credentials";

describe("validateCredentials", () => {
  it("accepts a good email and password", () => {
    expect(validateCredentials("sign-up", "ayesha@example.com", "correct horse")).toEqual({});
    expect(validateCredentials("sign-in", "ayesha@example.com", "x")).toEqual({});
  });

  it("asks for an email and a password", () => {
    expect(validateCredentials("sign-in", "", "")).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });

  it("ignores spaces around the email", () => {
    expect(validateCredentials("sign-in", "  ayesha@example.com ", "x")).toEqual({});
  });

  it("explains an email that cannot be right", () => {
    for (const email of ["ayesha", "ayesha@", "@example.com", "ayesha@example", "aye sha@example.com"]) {
      expect(validateCredentials("sign-in", email, "x").email, email).toContain("email address");
    }
  });

  it("needs 8 characters for a new password but not to sign in", () => {
    expect(validateCredentials("sign-up", "a@b.co", "1234567").password).toBe("Use at least 8 characters.");
    expect(validateCredentials("sign-up", "a@b.co", "12345678")).toEqual({});
    expect(validateCredentials("sign-in", "a@b.co", "1234567")).toEqual({});
  });

  it("refuses a password longer than 72 bytes (letters outside English count for more)", () => {
    expect(validateCredentials("sign-up", "a@b.co", "x".repeat(73)).password).toBe("Use at most 72 characters.");
    expect(validateCredentials("sign-up", "a@b.co", "x".repeat(72))).toEqual({});
    expect(validateCredentials("sign-up", "a@b.co", "é".repeat(37)).password).toBe("Use at most 72 characters.");
  });
});
