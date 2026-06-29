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

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initSensitiveStrings } from "./sensitiveBlacklist";

describe("initSensitiveStrings", () => {
  let tempDir: string;
  let originalUserDataDir: string | undefined;

  beforeEach(() => {
    _resetSensitiveStringsForTests();
    tempDir = mkdtempSync(join(tmpdir(), "smm-sens-test-"));
    originalUserDataDir = process.env.USER_DATA_DIR;
    process.env.USER_DATA_DIR = tempDir;
  });

  afterEach(() => {
    if (originalUserDataDir === undefined) {
      delete process.env.USER_DATA_DIR;
    } else {
      process.env.USER_DATA_DIR = originalUserDataDir;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("succeeds and adds only the hostname when smm.json is missing", async () => {
    await expect(initSensitiveStrings()).resolves.not.toThrow();
    const hostname = os.hostname();
    if (hostname) {
      expect(maskSensitive(`the host is ${hostname}`)).toBe("the host is ******");
    }
    expect(maskSensitive("just a normal string")).toBe("just a normal string");
  });

  it("collects all non-empty apiKey fields from a valid smm.json", async () => {
    writeFileSync(
      join(tempDir, "smm.json"),
      JSON.stringify({
        tmdb: { apiKey: "tmdb-abc", host: "" },
        tvdb: { apiKey: "tvdb-def" },
        ai: {
          openai: { apiKey: "openai-ghi" },
          custom: { apiKey: "" }, // empty — should be skipped
        },
        aiProviders: [
          { name: "provider1", apiKey: "prov-jkl" },
          { name: "provider2", baseURL: "http://x" }, // no apiKey
        ],
      }),
    );

    await initSensitiveStrings();

    expect(maskSensitive("use tmdb-abc here")).toBe("use ****** here");
    expect(maskSensitive("and tvdb-def too")).toBe("and ****** too");
    expect(maskSensitive("and openai-ghi")).toBe("and ******");
    expect(maskSensitive("and prov-jkl")).toBe("and ******");
  });

  it("warns and continues when smm.json is malformed", async () => {
    writeFileSync(join(tempDir, "smm.json"), "not valid json{{{");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(initSensitiveStrings()).resolves.not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    // Init must have continued past the parse error: hostname should still be in the set.
    const hostname = os.hostname();
    if (hostname) {
      expect(maskSensitive(`the host is ${hostname}`)).toBe("the host is ******");
    }

    warnSpy.mockRestore();
  });

  it("warns and continues when os.hostname() throws", async () => {
    const spy = vi.spyOn(os, "hostname").mockImplementation(() => {
      throw new Error("hostname failed");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(initSensitiveStrings()).resolves.not.toThrow();
    expect(warnSpy).toHaveBeenCalled();

    spy.mockRestore();
    warnSpy.mockRestore();
  });

  it("re-seeds: a second call replaces the previous set", async () => {
    writeFileSync(
      join(tempDir, "smm.json"),
      JSON.stringify({ tmdb: { apiKey: "old-key" } }),
    );
    await initSensitiveStrings();
    expect(maskSensitive("contains old-key")).toBe("contains ******");

    writeFileSync(
      join(tempDir, "smm.json"),
      JSON.stringify({ tmdb: { apiKey: "new-key" } }),
    );
    await initSensitiveStrings();
    // Old key should be gone after re-seed:
    expect(maskSensitive("contains old-key")).toBe("contains old-key");
    expect(maskSensitive("contains new-key")).toBe("contains ******");
  });
});

import { Writable } from "node:stream";
import { wrapWithMasking } from "./sensitiveBlacklist";

describe("wrapWithMasking", () => {
  beforeEach(() => {
    _resetSensitiveStringsForTests();
  });

  it("masks each write through the inner stream", () => new Promise<void>((resolve) => {
    const writes: string[] = [];
    const inner = new Writable({
      write(chunk, _enc, cb) {
        writes.push(chunk.toString());
        cb();
      },
    });
    const wrapped = wrapWithMasking(inner);
    addSensitiveString("secret");

    wrapped.write("hello secret world", () => {
      expect(writes).toEqual(["hello ****** world"]);
      resolve();
    });
  }));

  it("passes empty string through unchanged", () => new Promise<void>((resolve) => {
    const writes: string[] = [];
    const inner = new Writable({
      write(chunk, _enc, cb) {
        writes.push(chunk.toString());
        cb();
      },
    });
    const wrapped = wrapWithMasking(inner);
    addSensitiveString("secret");

    wrapped.write("", () => {
      expect(writes).toEqual([""]);
      resolve();
    });
  }));

  it("preserves the encoding argument on the inner write", () => new Promise<void>((resolve) => {
    let receivedEncoding: BufferEncoding | undefined;
    const inner = new Writable({
      decodeStrings: false,
      write(_chunk, encoding, cb) {
        receivedEncoding = encoding;
        cb();
      },
    });
    const wrapped = wrapWithMasking(inner);

    wrapped.write("payload", "utf-8", () => {
      expect(receivedEncoding).toBe("utf-8");
      resolve();
    });
  }));

  it("propagates underlying write errors via the callback", () => new Promise<void>((resolve) => {
    const inner = new Writable({
      write(_chunk, _enc, cb) {
        cb(new Error("boom"));
      },
    });
    const wrapped = wrapWithMasking(inner);
    // Suppress uncaught error from the Writable (we test via the callback).
    wrapped.on("error", () => {});

    wrapped.write("data", (err) => {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("boom");
      resolve();
    });
  }));
});
