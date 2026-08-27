import { describe, expect, it } from "vitest";
import type { FsPort } from "../ports/FsPort";
import { UserConfigHelper } from "./userConfigHelper";
import { userConfigPath } from "./paths";
import { validateUserConfigValue } from "./userConfigValidation";

function delayedFs(seed: Record<string, string>, delayMs = 15): FsPort {
  const files = new Map(Object.entries(seed));
  const pause = () => new Promise((r) => setTimeout(r, delayMs));
  return {
    readTextFile: async (path: string) => {
      await pause();
      const v = files.get(path);
      if (v === undefined) throw new Error("ENOENT: " + path);
      return v;
    },
    writeTextFile: async (path: string, content: string) => {
      await pause();
      files.set(path, content);
    },
    writeBinaryFile: async () => {},
    exists: async (path: string) => {
      await pause();
      return files.has(path);
    },
    listFiles: async () => [],
    deleteFile: async (path: string) => {
      files.delete(path);
    },
    rename: async () => {},
    mkdir: async () => {},
    listSubdirectories: async () => [],
  };
}

describe("UserConfigHelper", () => {
  it("keeps both folders when two instances update the same smm.json concurrently", async () => {
    const appDataDir = "/data/smm-userconfig-mutex";
    const fs = delayedFs({
      [userConfigPath(appDataDir)]: JSON.stringify({
        folders: [],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
      }),
    });
    const a = new UserConfigHelper(fs, appDataDir);
    const b = new UserConfigHelper(fs, appDataDir);

    await Promise.all([
      a.update((config) => ({ ...config, folders: [...config.folders, "/m/A"] })),
      b.update((config) => ({ ...config, folders: [...config.folders, "/m/B"] })),
    ]);

    const saved = await a.read();
    expect([...saved.folders].sort()).toEqual(["/m/A", "/m/B"]);
  });

  it("setKey validates dryRun as boolean", async () => {
    const fs = delayedFs({});
    const store = new UserConfigHelper(fs, "/data/smm");

    await expect(store.setKey("dryRun", "yes")).rejects.toThrow("dryRun must be a boolean");
    const updated = await store.setKey("dryRun", true);
    expect(updated.dryRun).toBe(true);
  });

  it("setKey rejects unknown keys", async () => {
    const fs = delayedFs({});
    const store = new UserConfigHelper(fs, "/data/smm");

    await expect(store.setKey("notAKey" as "dryRun", true)).rejects.toThrow("Unknown config key");
  });

  it("getKey reads a single field", async () => {
    const appDataDir = "/data/smm";
    const fs = delayedFs({
      [userConfigPath(appDataDir)]: JSON.stringify({
        folders: ["/m/A"],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
      }),
    });
    const store = new UserConfigHelper(fs, appDataDir);

    expect(await store.getKey("folders")).toEqual(["/m/A"]);
    expect(await store.getFolders()).toEqual(["/m/A"]);
  });

  it("addFolder deduplicates paths", async () => {
    const fs = delayedFs({});
    const store = new UserConfigHelper(fs, "/data/smm");

    await store.addFolder("/m/A");
    const updated = await store.addFolder("/m/A");

    expect(updated.folders).toEqual(["/m/A"]);
  });
});

describe("validateUserConfigValue", () => {
  it("accepts valid primaryDatabase values", () => {
    expect(validateUserConfigValue("primaryDatabase", "TMDB")).toBe("TMDB");
    expect(validateUserConfigValue("primaryDatabase", "TVDB")).toBe("TVDB");
  });

  it("rejects invalid mcpPort", () => {
    expect(() => validateUserConfigValue("mcpPort", 0)).toThrow("mcpPort must be an integer");
    expect(() => validateUserConfigValue("mcpPort", "30001")).toThrow("mcpPort must be an integer");
  });
});
