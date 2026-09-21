import { describe, expect, it } from "vitest";
import type { UserConfig } from "@smm/types";
import { applyUserConfigPatch } from "./userConfigPatch.ts";

const baseConfig: UserConfig = {
  folders: ["/media/a"],
  tmdb: {},
  tvdb: {},
  renameRules: [],
  dryRun: false,
  selectedRenameRule: "plex",
};

describe("applyUserConfigPatch", () => {
  it("adds a scalar field", () => {
    const next = applyUserConfigPatch(baseConfig, [
      { op: "add", path: "/ytdlpProxy", value: "socks5://127.0.0.1:1080" },
    ]);
    expect(next.ytdlpProxy).toBe("socks5://127.0.0.1:1080");
    expect(next.folders).toEqual(["/media/a"]);
  });

  it("appends a media folder without rewriting the rest of the document", () => {
    const next = applyUserConfigPatch(baseConfig, [
      { op: "add", path: "/folders/-", value: "/media/b" },
    ]);
    expect(next.folders).toEqual(["/media/a", "/media/b"]);
  });

  it("applies several field operations in one patch", () => {
    const next = applyUserConfigPatch(baseConfig, [
      { op: "add", path: "/anonymousTelemetryConsent", value: true },
      { op: "replace", path: "/dryRun", value: true },
    ]);
    expect(next.anonymousTelemetryConsent).toBe(true);
    expect(next.dryRun).toBe(true);
  });

  it("rejects a root replace", () => {
    expect(() =>
      applyUserConfigPatch(baseConfig, [
        { op: "replace", path: "", value: { ...baseConfig, dryRun: true } },
      ]),
    ).toThrow(/not allowed/);
  });

  it("rejects move, copy, and test", () => {
    expect(() =>
      applyUserConfigPatch(baseConfig, [
        { op: "move", path: "/dryRun", from: "/selectedRenameRule" },
      ]),
    ).toThrow(/operation/);
  });

  it("rejects an unknown field", () => {
    expect(() =>
      applyUserConfigPatch(baseConfig, [{ op: "add", path: "/evil", value: true }]),
    ).toThrow(/not allowed/);
  });

  it("rejects an invalid value and leaves the input unchanged", () => {
    expect(() =>
      applyUserConfigPatch(baseConfig, [{ op: "replace", path: "/dryRun", value: "yes" }]),
    ).toThrow(/dryRun/);
    expect(baseConfig.dryRun).toBe(false);
  });
});
