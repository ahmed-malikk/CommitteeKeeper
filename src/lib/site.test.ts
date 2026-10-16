import { describe, expect, it } from "vitest";
import { site } from "./site";

describe("site", () => {
  it("has a name, a tagline and a description for the page title and home page", () => {
    expect(site.name).toBe("CommitteeKeeper");
    expect(site.tagline.length).toBeGreaterThan(0);
    expect(site.description.length).toBeGreaterThan(0);
  });
});
