import { describe, expect, it, vi } from "vitest";
import { Path } from "@core/path";
import type { FsPort } from "./ports/FsPort";
import type { NetworkPort } from "./ports/NetworkPort";
import { NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { Core } from "./Core";
import { metadataCachePath, planFilePath, userConfigPath } from "./pipeline/paths";

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
    listFiles: vi.fn(async (dir: string) => {
      const out: string[] = [];
      for (const key of files.keys()) {
        if (key.startsWith(dir + "/") && !key.endsWith("/")) out.push(key);
      }
      return out;
    }),
    deleteFile: vi.fn(async (path: string) => {
      files.delete(path);
    }),
    rename: vi.fn(async (from: string, to: string) => {
      if (!files.has(from) && ![...files.keys()].some((k) => k === from || k.startsWith(from + "/"))) {
        throw new Error("ENOENT: " + from);
      }
      const entries = [...files.entries()];
      for (const [key, value] of entries) {
        if (key === from || key.startsWith(from + "/")) {
          files.delete(key);
          files.set(to + key.slice(from.length), value);
        }
      }
      // Ensure destination directory marker if only empty dirs matter — file keys alone are enough for these tests.
    }),
    mkdir: vi.fn(async () => {}),
  };
}

/** Network that satisfies the empty-seed recognition path (returns no results). */
function emptyNetwork(): NetworkPort {
  return {
    fetch: vi.fn(async (url: string) => {
      const body =
        url.includes("/api/tmdb/") || url.includes("tmdb")
          ? { results: [], page: 1, total_pages: 1, total_results: 0 }
          : { status: "success", data: [] };
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        text: () => Promise.resolve(JSON.stringify(body)),
        json: <T>() => Promise.resolve(body as T),
      };
    }) as never,
  };
}

async function waitForStatus(core: Core, id: string, status: string): Promise<void> {
  const started = Date.now();
  for (;;) {
    const job = core.getJob(id);
    if (job?.status === status || job?.status === "failed" || job?.status === "aborted") return;
    if (Date.now() - started > 5000) throw new Error(`timeout waiting for ${status}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("Core", () => {
  it("importFolder runs the pipeline and succeeds", async () => {
    const fs = inMemoryFs({ "/m/My.Music/a.mp3": "" });
    const core = new Core({
      fs,
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });

    const { id } = core.importFolder("/m/My.Music", "music");
    expect(core.getJob(id)).toBeDefined();

    await waitForStatus(core, id, "succeeded");

    const job = core.getJob(id);
    expect(job?.status).toBe("succeeded");
    expect(job?.progress).toBe(100);

    const savedConfig = JSON.parse((await fs.readTextFile(userConfigPath("/data/smm"))) as string);
    expect(savedConfig.folders).toContain("/m/My.Music");
  });

  it("marks the job failed when the pipeline throws", async () => {
    const fs = inMemoryFs();
    const failingFs: FsPort = {
      ...fs,
      listFiles: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const core = new Core({
      fs: failingFs,
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });

    const { id } = core.importFolder("/m/Broken", "tvshow");
    await waitForStatus(core, id, "failed");

    const job = core.getJob(id);
    expect(job?.status).toBe("failed");
    expect(job?.error).toContain("boom");
  });

  it("invalid path produces a failed job, not a synchronous throw", async () => {
    const core = new Core({ fs: inMemoryFs(), network: emptyNetwork(), appDataDir: "/data/smm" });
    const { id } = core.importFolder("relative/path", "music");
    expect(id).toBeDefined();
    await waitForStatus(core, id, "failed");
    const job = core.getJob(id);
    expect(job?.status).toBe("failed");
  });

  it("skipInit writes the folder to UserConfig and does not persist metadata", async () => {
    const fs = inMemoryFs();
    const core = new Core({
      fs,
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });

    const { id } = core.importFolder("/m/Deferred", "tvshow", { skipInit: true });
    await waitForStatus(core, id, "succeeded");

    expect(core.getJob(id)?.status).toBe("succeeded");
    const savedConfig = JSON.parse((await fs.readTextFile(userConfigPath("/data/smm"))) as string);
    expect(savedConfig.folders).toContain("/m/Deferred");
    expect(fs.listFiles).not.toHaveBeenCalled();
    expect(await fs.exists(metadataCachePath("/data/smm", Path.posix("/m/Deferred")))).toBe(false);
  });

  it("getJob returns undefined for unknown id", () => {
    const core = new Core({
      fs: inMemoryFs(),
      network: emptyNetwork(),
      appDataDir: "/data/smm",
    });
    expect(core.getJob("nope")).toBeUndefined();
  });
});

describe("getAppConfig", () => {
  it("returns the injected app config values", () => {
    const core = new Core({
      fs: inMemoryFs(),
      network: emptyNetwork(),
      appDataDir: "/data/smm",
      version: "1.3.8",
      reverseProxyUrl: "http://127.0.0.1:30005",
      userDataDir: "/data/ud",
    });
    expect(core.getAppConfig()).toEqual({
      version: "1.3.8",
      userDataDir: "/data/ud",
      reverseProxyUrl: "http://127.0.0.1:30005",
    });
  });

  it("falls back to defaults when version/reverseProxyUrl/userDataDir are omitted", () => {
    const core = new Core({ fs: inMemoryFs(), network: emptyNetwork(), appDataDir: "/data/smm" });
    expect(core.getAppConfig()).toEqual({
      version: "",
      userDataDir: "/data/smm",
      reverseProxyUrl: null,
    });
  });
});

describe("getUserConfig", () => {
  it("returns the default config when no smm.json exists", async () => {
    const core = new Core({ fs: inMemoryFs(), network: emptyNetwork(), appDataDir: "/data/smm" });
    const config = await core.getUserConfig();
    expect(config.folders).toEqual([]);
    expect(config.tmdb).toEqual({});
    expect(config.selectedRenameRule).toBe("plex");
  });

  it("returns the persisted config when smm.json exists", async () => {
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: JSON.stringify({
        folders: ["/m/Show"],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
      }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });
    expect((await core.getUserConfig()).folders).toEqual(["/m/Show"]);
  });
});

describe("setUserConfigKey", () => {
  it("persists a known key and returns the updated config", async () => {
    const fs = inMemoryFs();
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    const updated = await core.setUserConfigKey("dryRun", true);

    expect(updated.dryRun).toBe(true);
    expect((await core.getUserConfig()).dryRun).toBe(true);
    const written = JSON.parse(await fs.readTextFile(userConfigPath("/data/smm"))) as {
      dryRun: boolean;
    };
    expect(written.dryRun).toBe(true);
  });

  it("rejects an unknown key without writing", async () => {
    const fs = inMemoryFs();
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await expect(core.setUserConfigKey("notAKey", 1)).rejects.toThrow("Unknown config key: notAKey");
    expect(await fs.exists(userConfigPath("/data/smm"))).toBe(false);
  });
});

describe("getFolders", () => {
  it("returns the folders from the user config", async () => {
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: JSON.stringify({
        folders: ["/m/A", "/m/B"],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
      }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });
    expect(await core.getFolders()).toEqual(["/m/A", "/m/B"]);
  });

  it("returns an empty list when no config exists", async () => {
    const core = new Core({ fs: inMemoryFs(), network: emptyNetwork(), appDataDir: "/data/smm" });
    expect(await core.getFolders()).toEqual([]);
  });
});

describe("setMetadata", () => {
  const cache = metadataCachePath("/data/smm", "/m/Show");

  it("persists metadata and strips files so getMediaMetadata round-trips without files", async () => {
    const fs = inMemoryFs();
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });
    const mm = {
      mediaFolderPath: "/m/Show",
      type: "tvshow-folder" as const,
      files: ["/m/Show/S01E01.mkv"],
      mediaFiles: [{ absolutePath: "/m/Show/S01E01.mkv" }],
    };

    await core.setMetadata(mm);

    const written = JSON.parse(await fs.readTextFile(cache)) as Record<string, unknown>;
    expect(written).toEqual({
      mediaFolderPath: "/m/Show",
      type: "tvshow-folder",
      mediaFiles: [{ absolutePath: "/m/Show/S01E01.mkv" }],
    });
    expect(written).not.toHaveProperty("files");
    expect(await core.getMediaMetadata("/m/Show")).toEqual(written);
  });

  it("fully replaces an existing cache file", async () => {
    const fs = inMemoryFs({
      [cache]: JSON.stringify({ mediaFolderPath: "/m/Show", type: "tvshow-folder", tvShow: { name: "Old" } }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await core.setMetadata({
      mediaFolderPath: "/m/Show",
      type: "movie-folder",
      movie: { id: "1", name: "New", database: "TMDB" },
    });

    expect(await core.getMediaMetadata("/m/Show")).toEqual({
      mediaFolderPath: "/m/Show",
      type: "movie-folder",
      movie: { id: "1", name: "New", database: "TMDB" },
    });
  });

  it("rejects missing mediaFolderPath without writing", async () => {
    const fs = inMemoryFs();
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await expect(core.setMetadata({ type: "tvshow-folder" })).rejects.toThrow("Media folder path is required");
    expect(fs.writeTextFile).not.toHaveBeenCalled();
  });

  it("rejects an empty mediaFolderPath without writing", async () => {
    const fs = inMemoryFs();
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await expect(core.setMetadata({ mediaFolderPath: "", type: "tvshow-folder" })).rejects.toThrow(
      "Media folder path is required",
    );
    expect(fs.writeTextFile).not.toHaveBeenCalled();
  });

  it("uses the same cache key as getMediaMetadata for a Windows path", async () => {
    const stored = "C:\\Movies\\Show";
    const winCache = metadataCachePath("/data/smm", Path.posix(stored));
    const fs = inMemoryFs();
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await core.setMetadata({ mediaFolderPath: stored, type: "tvshow-folder" });

    expect(await fs.exists(winCache)).toBe(true);
    expect(await core.getMediaMetadata(stored)).toEqual({
      mediaFolderPath: stored,
      type: "tvshow-folder",
    });
  });
});

describe("getMediaMetadata", () => {
  const cache = metadataCachePath("/data/smm", "/m/Show");

  it("returns the cached metadata for a folder", async () => {
    const mm = { mediaFolderPath: "/m/Show", type: "tvshow-folder" };
    const fs = inMemoryFs({ [cache]: JSON.stringify(mm) });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });
    expect(await core.getMediaMetadata("/m/Show")).toEqual(mm);
  });

  it("returns null when there is no cache", async () => {
    const core = new Core({ fs: inMemoryFs(), network: emptyNetwork(), appDataDir: "/data/smm" });
    expect(await core.getMediaMetadata("/m/Show")).toBeNull();
  });

  it("returns null when the cache JSON is corrupt", async () => {
    const fs = inMemoryFs({ [cache]: "{ not json" });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });
    expect(await core.getMediaMetadata("/m/Show")).toBeNull();
  });
});

describe("unimportFolder", () => {
  const cache = metadataCachePath("/data/smm", "/m/Show");

  function configWith(folders: string[]): string {
    return JSON.stringify({ folders, tmdb: {}, tvdb: {}, renameRules: [], dryRun: false, selectedRenameRule: "plex" });
  }

  it("removes the folder from config and deletes its metadata cache", async () => {
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: configWith(["/m/Show", "/m/Keep"]),
      [cache]: JSON.stringify({ mediaFolderPath: "/m/Show" }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await core.unimportFolder("/m/Show");

    expect(JSON.parse((await fs.readTextFile(userConfigPath("/data/smm"))) as string).folders).toEqual(["/m/Keep"]);
    expect(await fs.exists(cache)).toBe(false);
  });

  it("is a no-op and keeps the cache when the folder is not imported", async () => {
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: configWith(["/m/Keep"]),
      [cache]: JSON.stringify({ mediaFolderPath: "/m/Show" }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await core.unimportFolder("/m/Show");

    expect(JSON.parse((await fs.readTextFile(userConfigPath("/data/smm"))) as string).folders).toEqual(["/m/Keep"]);
    expect(await fs.exists(cache)).toBe(true);
  });

  it("unimports a folder stored in Windows backslash form (same format as import)", async () => {
    const stored = "C:\\Movies\\Show";
    const cache = metadataCachePath("/data/smm", Path.posix(stored));
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: configWith([stored]),
      [cache]: JSON.stringify({ mediaFolderPath: stored }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await core.unimportFolder(stored);

    expect(JSON.parse((await fs.readTextFile(userConfigPath("/data/smm"))) as string).folders).toEqual([]);
    expect(await fs.exists(cache)).toBe(false);
  });

  it("removes every folder when unimportFolder runs concurrently", async () => {
    const appDataDir = "/data/smm-concurrent-unimport";
    const folders = ["/m/A", "/m/B", "/m/C", "/m/D", "/m/E"];
    const pause = () => new Promise((r) => setTimeout(r, 15));
    const files = new Map<string, string>([[userConfigPath(appDataDir), configWith(folders)]]);
    const fs: FsPort = {
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
      exists: async (path: string) => files.has(path),
      listFiles: async () => [],
      deleteFile: async (path: string) => {
        files.delete(path);
      },
      rename: async () => {},
      mkdir: async () => {},
    };
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });

    await Promise.all(folders.map((path) => core.unimportFolder(path)));

    const saved = JSON.parse(await fs.readTextFile(userConfigPath(appDataDir))) as { folders: string[] };
    expect(saved.folders).toEqual([]);
  });
});

describe("renameFolder", () => {
  it("updates metadata cache, user config, and renames on disk", async () => {
    const from = "/m/Show";
    const to = "/m/Show Renamed";
    const oldCache = metadataCachePath("/data/smm", from);
    const newCache = metadataCachePath("/data/smm", to);
    const mm = {
      mediaFolderPath: from,
      type: "tvshow-folder" as const,
      files: [`${from}/S01E01.mkv`],
      mediaFiles: [{ absolutePath: `${from}/S01E01.mkv` }],
    };
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: JSON.stringify({
        folders: [from],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
      }),
      [oldCache]: JSON.stringify(mm),
      [`${from}/S01E01.mkv`]: "",
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await core.renameFolder({ from, to });

    expect(await fs.exists(oldCache)).toBe(false);
    expect(await fs.exists(newCache)).toBe(true);
    const written = JSON.parse(await fs.readTextFile(newCache)) as typeof mm;
    expect(written.mediaFolderPath).toBe(to);
    expect(written.files).toEqual([`${to}/S01E01.mkv`]);
    expect(written.mediaFiles?.[0]?.absolutePath).toBe(`${to}/S01E01.mkv`);

    const folders = await core.getFolders();
    // renameFolderInUserConfig stores Path.toPlatformPath(to)
    expect(folders.map((f) => Path.posix(f))).toEqual([Path.posix(to)]);

    expect(fs.rename).toHaveBeenCalledWith(from, to);
    expect(await fs.exists(`${to}/S01E01.mkv`)).toBe(true);
  });

  it("rejects when the folder is not managed", async () => {
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: JSON.stringify({
        folders: ["/m/Other"],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
      }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await expect(core.renameFolder({ from: "/m/Show", to: "/m/X" })).rejects.toThrow(
      "/m/Show is not managed by SMM",
    );
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it("rejects when media metadata cache is missing", async () => {
    const from = "/m/Show";
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: JSON.stringify({
        folders: [from],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
      }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await expect(core.renameFolder({ from, to: "/m/X" })).rejects.toThrow(
      `Media metadata not found: ${from}`,
    );
    expect(fs.rename).not.toHaveBeenCalled();
  });
});

describe("tryToRecognizeFolder", () => {
  const appDataDir = "/data";
  const folder = "/m/Show";
  const tvMetadata = {
    mediaFolderPath: folder,
    type: "tvshow-folder" as const,
    tvShow: {
      id: "1",
      name: "Show",
      seasons: [
        {
          season: 1,
          episodes: [
            { season: 1, episode: 1 },
            { season: 1, episode: 2 },
          ],
        },
      ],
    },
    mediaFiles: [],
  };

  function seed(disk: Record<string, string> = {}) {
    return inMemoryFs({
      [userConfigPath(appDataDir)]: JSON.stringify({ folders: [folder] }),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(tvMetadata),
      ...disk,
    });
  }

  it("creates a pending plan with matched files", async () => {
    const fs = seed({
      "/m/Show/S01E01.mkv": "",
      "/m/Show/S01E02.mkv": "",
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });
    const plan = await core.tryToRecognizeFolder("/m/Show");
    expect(plan.task).toBe("recognize-media-file");
    expect(plan.status).toBe("pending");
    expect(plan.creator).toBe("app");
    expect(plan.files).toEqual([
      { season: 1, episode: 1, path: "/m/Show/S01E01.mkv" },
      { season: 1, episode: 2, path: "/m/Show/S01E02.mkv" },
    ]);
    expect(await fs.exists(planFilePath("/data", plan.id))).toBe(true);
  });

  it("returns pending plan with empty files when nothing matches", async () => {
    const fs = seed({ "/m/Show/random.mkv": "" });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });
    const plan = await core.tryToRecognizeFolder("/m/Show");
    expect(plan.files).toEqual([]);
    expect(plan.status).toBe("pending");
  });

  it("rejects unmanaged folders", async () => {
    const fs = seed();
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });
    await expect(core.tryToRecognizeFolder("/m/Other")).rejects.toThrow(/not managed by SMM/);
  });
});

describe("tryToRenameFolder", () => {
  const appDataDir = "/data";
  const folder = "/m/Show";
  const tvMetadata = {
    mediaFolderPath: folder,
    type: "tvshow-folder" as const,
    tvShow: {
      id: "1",
      name: "Show",
      seasons: [
        {
          season: 1,
          episodes: [{ season: 1, episode: 1, name: "Ep1" }],
        },
      ],
    },
    mediaFiles: [{ absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 }],
  };

  function seed() {
    return inMemoryFs({
      [userConfigPath(appDataDir)]: JSON.stringify({ folders: [folder] }),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(tvMetadata),
    });
  }

  it("creates a pending rename-files plan with plex targets", async () => {
    const fs = seed();
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });
    const plan = await core.tryToRenameFolder("/m/Show");
    expect(plan.task).toBe("rename-files");
    expect(plan.status).toBe("pending");
    expect(plan.creator).toBe("app");
    expect(plan.mediaFolderPath).toBe("/m/Show");
    expect(plan.files).toEqual([
      {
        from: "/m/Show/S01E01.mkv",
        to: "/m/Show/Season 01/Show - S01E01 - Ep1.mkv",
      },
    ]);
    expect(await fs.exists(planFilePath("/data", plan.id))).toBe(true);
  });

  it("returns pending plan with empty files when paths already match", async () => {
    const matching = "/m/Show/Season 01/Show - S01E01 - Ep1.mkv";
    const fs = inMemoryFs({
      [userConfigPath(appDataDir)]: JSON.stringify({ folders: [folder] }),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify({
        ...tvMetadata,
        mediaFiles: [{ absolutePath: matching, seasonNumber: 1, episodeNumber: 1 }],
      }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });
    const plan = await core.tryToRenameFolder("/m/Show");
    expect(plan.files).toEqual([]);
    expect(plan.status).toBe("pending");
  });

  it("rejects unmanaged folders", async () => {
    const fs = seed();
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });
    await expect(core.tryToRenameFolder("/m/Other")).rejects.toThrow(/not managed by SMM/);
  });
});

describe("applyPlan", () => {
  const appDataDir = "/data";
  const folder = "/m/Show";
  const tvMetadata = {
    mediaFolderPath: folder,
    type: "tvshow-folder" as const,
    tvShow: {
      id: "1",
      name: "Show",
      seasons: [
        {
          season: 1,
          episodes: [
            { season: 1, episode: 1 },
            { season: 1, episode: 2 },
          ],
        },
      ],
    },
    mediaFiles: [] as { absolutePath: string; seasonNumber?: number; episodeNumber?: number }[],
  };

  function seed(disk: Record<string, string> = {}) {
    return inMemoryFs({
      [userConfigPath(appDataDir)]: JSON.stringify({ folders: [folder] }),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(tvMetadata),
      ...disk,
    });
  }

  it("merges mediaFiles and deletes the plan file", async () => {
    const fs = seed({
      "/m/Show/S01E01.mkv": "",
      "/m/Show/S01E02.mkv": "",
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });
    const plan = await core.tryToRecognizeFolder("/m/Show");
    await core.applyPlan(plan);
    const mm = await core.getMediaMetadata("/m/Show");
    expect(mm?.mediaFiles).toEqual([
      { absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 },
      { absolutePath: "/m/Show/S01E02.mkv", seasonNumber: 1, episodeNumber: 2 },
    ]);
    expect(await fs.exists(planFilePath("/data", plan.id))).toBe(false);
  });

  it("applies empty files plan as no-op on mediaFiles but deletes plan", async () => {
    const fs = seed({ "/m/Show/random.mkv": "" });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });
    const before = await core.getMediaMetadata("/m/Show");
    const plan = await core.tryToRecognizeFolder("/m/Show");
    expect(plan.files).toEqual([]);
    await core.applyPlan(plan);
    const after = await core.getMediaMetadata("/m/Show");
    expect(after?.mediaFiles).toEqual(before?.mediaFiles ?? []);
    expect(await fs.exists(planFilePath("/data", plan.id))).toBe(false);
  });

  it("getPlan throws when missing", async () => {
    const core = new Core({ fs: inMemoryFs(), network: emptyNetwork(), appDataDir });
    await expect(core.getPlan("nope")).rejects.toThrow("Plan not found: nope");
  });

  it("renames video and subtitle and updates mediaFiles", async () => {
    const renameMetadata = {
      ...tvMetadata,
      tvShow: {
        id: "1",
        name: "Show",
        seasons: [
          {
            season: 1,
            episodes: [{ season: 1, episode: 1, name: "Ep1" }],
          },
        ],
      },
      mediaFiles: [{ absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 }],
    };
    const fs = inMemoryFs({
      [userConfigPath(appDataDir)]: JSON.stringify({ folders: [folder] }),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(renameMetadata),
      "/m/Show/S01E01.mkv": "",
      "/m/Show/S01E01.ass": "",
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });
    const plan = await core.tryToRenameFolder("/m/Show");
    await core.applyPlan(plan);

    const targetVideo = "/m/Show/Season 01/Show - S01E01 - Ep1.mkv";
    const targetSubtitle = "/m/Show/Season 01/Show - S01E01 - Ep1.ass";
    expect(await fs.exists(targetVideo)).toBe(true);
    expect(await fs.exists(targetSubtitle)).toBe(true);
    expect(await fs.exists("/m/Show/S01E01.mkv")).toBe(false);
    expect(await fs.exists("/m/Show/S01E01.ass")).toBe(false);

    const mm = await core.getMediaMetadata("/m/Show");
    expect(mm?.mediaFiles).toEqual([
      { absolutePath: targetVideo, seasonNumber: 1, episodeNumber: 1 },
    ]);
    expect(await fs.exists(planFilePath("/data", plan.id))).toBe(false);
  });

  it("applies empty rename-files plan as delete only", async () => {
    const matching = "/m/Show/Season 01/Show - S01E01 - Ep1.mkv";
    const renameMetadata = {
      ...tvMetadata,
      tvShow: {
        id: "1",
        name: "Show",
        seasons: [
          {
            season: 1,
            episodes: [{ season: 1, episode: 1, name: "Ep1" }],
          },
        ],
      },
      mediaFiles: [{ absolutePath: matching, seasonNumber: 1, episodeNumber: 1 }],
    };
    const fs = inMemoryFs({
      [userConfigPath(appDataDir)]: JSON.stringify({ folders: [folder] }),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(renameMetadata),
      [matching]: "",
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });
    const before = await core.getMediaMetadata("/m/Show");
    const plan = await core.tryToRenameFolder("/m/Show");
    expect(plan.files).toEqual([]);
    await core.applyPlan(plan);
    const after = await core.getMediaMetadata("/m/Show");
    expect(after?.mediaFiles).toEqual(before?.mediaFiles ?? []);
    expect(await fs.exists(planFilePath("/data", plan.id))).toBe(false);
  });

  it("rejects unsupported tasks", async () => {
    const core = new Core({ fs: inMemoryFs(), network: emptyNetwork(), appDataDir });
    await expect(
      core.applyPlan({
        id: "x1",
        task: "unknown-task" as "recognize-media-file",
        status: "pending",
        creator: "app",
        mediaFolderPath: "/m/Show",
        files: [],
      }),
    ).rejects.toThrow(/Unsupported plan task/);
  });
});
