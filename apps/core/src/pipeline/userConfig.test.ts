import { describe, expect, it } from "vitest";
import type { FsPort } from "../ports/FsPort";
import { UserConfig } from "./userConfig";
import { userConfigPath } from "./paths";

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
    exists: async (path: string) => {
      await pause();
      return files.has(path);
    },
    listFiles: async () => [],
    deleteFile: async (path: string) => {
      files.delete(path);
    },
    rename: async () => {},
  };
}

describe("UserConfig", () => {
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
    const a = new UserConfig(fs, appDataDir);
    const b = new UserConfig(fs, appDataDir);

    await Promise.all([
      a.update((config) => ({ ...config, folders: [...config.folders, "/m/A"] })),
      b.update((config) => ({ ...config, folders: [...config.folders, "/m/B"] })),
    ]);

    const saved = await a.read();
    expect([...saved.folders].sort()).toEqual(["/m/A", "/m/B"]);
  });
});
