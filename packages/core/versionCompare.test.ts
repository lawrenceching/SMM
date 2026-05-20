import { describe, expect, it } from "vitest";
import { isVersionGreater, parseVersion } from "./versionCompare";

describe("parseVersion", () => {
  it("parses three-part versions", () => {
    expect(parseVersion("1.2.4")).toEqual([1, 2, 4]);
  });

  it("parses two-part versions with implicit patch 0", () => {
    expect(parseVersion("1.2")).toEqual([1, 2, 0]);
  });

  it("strips pre-release suffix", () => {
    expect(parseVersion("1.2.4-test")).toEqual([1, 2, 4]);
  });

  it("returns null for invalid versions", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("a.b.c")).toBeNull();
    expect(parseVersion("1.2.3.4")).toBeNull();
  });
});

describe("isVersionGreater", () => {
  it("returns true when latest is greater", () => {
    expect(isVersionGreater("1.2.4", "1.2.3")).toBe(true);
    expect(isVersionGreater("2.0.0", "1.9.9")).toBe(true);
  });

  it("returns false when versions are equal", () => {
    expect(isVersionGreater("1.2.4", "1.2.4")).toBe(false);
  });

  it("returns false when latest is lower", () => {
    expect(isVersionGreater("1.2.3", "1.2.4")).toBe(false);
  });

  it("returns false for invalid version strings", () => {
    expect(isVersionGreater("invalid", "1.2.4")).toBe(false);
    expect(isVersionGreater("1.2.4", "invalid")).toBe(false);
  });
});
