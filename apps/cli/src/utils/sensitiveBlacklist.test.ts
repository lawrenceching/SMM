import { describe, it, expect, beforeEach } from "vitest";
import {
  addSensitiveString,
  maskSensitive,
  _resetSensitiveStringsForTests,
} from "./sensitiveBlacklist";

describe("maskSensitive", () => {
  beforeEach(() => {
    _resetSensitiveStringsForTests();
  });

  it("returns text unchanged when the set is empty", () => {
    expect(maskSensitive("nothing to mask here")).toBe("nothing to mask here");
  });

  it("replaces a single sensitive string", () => {
    addSensitiveString("secret");
    expect(maskSensitive("hello secret world")).toBe("hello ****** world");
  });

  it("replaces every occurrence", () => {
    addSensitiveString("abc");
    expect(maskSensitive("abc x abc y abc")).toBe("****** x ****** y ******");
  });

  it("does not add empty strings (so they do not match everywhere)", () => {
    addSensitiveString("");
    addSensitiveString("   ");
    expect(maskSensitive("any value with empty {matching} braces")).toBe(
      "any value with empty {matching} braces",
    );
  });

  it("replaces the longer string first so a shorter one cannot break it", () => {
    addSensitiveString("abc");
    addSensitiveString("abcdef");
    // If we replaced "abc" first, "abcdef" would become "******def" and
    // the longer substitution would miss. Length-descending order fixes this.
    expect(maskSensitive("the abcdef is here")).toBe("the ****** is here");
  });

  it("handles strings with regex special chars as plain literals (no escaping needed)", () => {
    addSensitiveString("a.b+c");
    expect(maskSensitive("value: a.b+c end")).toBe("value: ****** end");
  });

  it("returns empty string unchanged", () => {
    expect(maskSensitive("")).toBe("");
  });
});
