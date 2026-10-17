import { describe, expect, it } from "vitest";
import { validateMember, validateSlotCount } from "./member";

describe("validateMember", () => {
  it("accepts a name alone, and tidies spaces", () => {
    expect(validateMember({ name: "  Maryam   Khan ", email: "", phone: "" }).clean).toEqual({ name: "Maryam Khan", email: "", phone: "" });
  });

  it("accepts Urdu-script names and full contact details", () => {
    const r = validateMember({ name: "مریم خان", email: "maryam@example.com", phone: "+92 300 1234567" });
    expect(r.problems).toEqual({});
    expect(r.clean?.name).toBe("مریم خان");
  });

  it("refuses an empty name and one that is too long", () => {
    expect(validateMember({ name: "  ", email: "", phone: "" }).problems.name).toBe("Enter the member's name.");
    expect(validateMember({ name: "x".repeat(61), email: "", phone: "" }).problems.name).toMatch(/60 characters/);
  });

  it("refuses an email or phone that does not look right, each with its own message", () => {
    const r = validateMember({ name: "Ali", email: "not-an-email", phone: "abc" });
    expect(r.problems.email).toMatch(/email address/);
    expect(r.problems.phone).toMatch(/digits only/);
    expect(r.clean).toBeNull();
  });

  it("allows common phone formats", () => {
    for (const p of ["0300 1234567", "(042) 111-222-333", "+923001234567"]) {
      expect(validateMember({ name: "Ali", email: "", phone: p }).problems.phone).toBeUndefined();
    }
  });
});

describe("validateSlotCount", () => {
  it("accepts 1 up to the room left", () => {
    expect(validateSlotCount("1", 5)).toBeNull();
    expect(validateSlotCount("5", 5)).toBeNull();
  });

  it("refuses 0, text and more than the room", () => {
    expect(validateSlotCount("0", 5)).toMatch(/at least 1/);
    expect(validateSlotCount("two", 5)).toMatch(/at least 1/);
    expect(validateSlotCount("6", 5)).toBe("Only 5 slots are left in this committee.");
    expect(validateSlotCount("2", 1)).toBe("Only 1 slot is left in this committee.");
  });

  it("says so when the committee is full", () => {
    expect(validateSlotCount("1", 0)).toMatch(/already taken/);
  });
});
