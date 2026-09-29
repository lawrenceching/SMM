import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import type { NetworkPort } from "../ports/NetworkPort";
import { createRecognitionDeps } from "./createRecognitionDeps";
import { userConfigPath } from "./paths";

function inMemoryFs(seed: Record<string, string> = {}): FsPort {
  const files = new Map(Object.entries(seed));
  return {
    readTextFile: vi.fn(async (path: string) => {
      const v = files.get(path);
      if (v === undefined) throw new Error("ENOENT: " + path);
      return v;
    }),
    writeTextFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    writeBinaryFile: vi.fn(async () => {}),
    exists: vi.fn(async (path: string) => files.has(path)),
    listFiles: vi.fn(async () => []),
    deleteFile: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    listSubdirectories: vi.fn(async () => []),
  };
}

describe("createRecognitionDeps", () => {
  it("builds deps from smm.json and platform ports", async () => {
    const appDataDir = "/data/smm";
    const fs = inMemoryFs({
      [userConfigPath(appDataDir)]: JSON.stringify({
        folders: [],
        primaryDatabase: "TVDB",
        preferMediaLanguage: false,
        applicationLanguage: "en",
        tmdb: { host: "https://tmdb.example", apiKey: "tmdb-key" },
        tvdb: { host: "https://tvdb.example", apiKey: "tvdb-key" },
      }),
    });
    const network = { fetch: vi.fn() } satisfies NetworkPort;

    const deps = await createRecognitionDeps({
      fs,
      network,
      appDataDir,
      normalizePosix: (p) => p,
      osLocale: "en-US",
    });

    expect(deps.fs).toBe(fs);
    expect(deps.appDataDir).toBe(appDataDir);
    expect(deps.primaryDatabase).toBe("TVDB");
    expect(deps.language).toBeTruthy();
    expect(deps.tmdb).toBeDefined();
    expect(deps.tvdb).toBeDefined();
  });
});
