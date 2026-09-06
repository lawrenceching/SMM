import { describe, expect, it } from "vitest";
import type { UserConfig } from "@smm/types";
import { validateUserConfig, validateUserConfigValue } from "./userConfigValidation";

describe("validateUserConfigValue aiAgent", () => {
  it("returns undefined for missing aiAgent", () => {
    expect(validateUserConfigValue("aiAgent", undefined)).toBeUndefined();
  });

  it("validates and preserves granted permissions", () => {
    expect(validateUserConfigValue("aiAgent", { permissions: ["metadata.write"] })).toEqual({
      permissions: ["metadata.write"],
    });
  });

  it("defaults permissions to empty array when absent", () => {
    expect(validateUserConfigValue("aiAgent", {})).toEqual({ permissions: [] });
  });

  it("rejects non-array permissions", () => {
    expect(() =>
      validateUserConfigValue("aiAgent", { permissions: "metadata.write" }),
    ).toThrow();
  });
});

describe("validateUserConfig", () => {
  it("preserves aiAgent instead of stripping it", () => {
    const validated = validateUserConfig({
      folders: [],
      tmdb: {},
      tvdb: {},
      renameRules: [],
      dryRun: false,
      selectedRenameRule: "plex",
      aiAgent: { permissions: ["metadata.write"] },
    } as UserConfig);
    expect(validated.aiAgent).toEqual({ permissions: ["metadata.write"] });
  });
});
