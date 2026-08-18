import { describe, expect, it, vi } from "vitest";
import { Path } from "@core/path";
import type { FsPort } from "./ports/FsPort";
import type { NetworkPort } from "./ports/NetworkPort";
import { NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { Core } from "./Core";
import { metadataCachePath, userConfigPath } from "./pipeline/paths";

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
      exists: async (path: string) => files.has(path),
      listFiles: async () => [],
      deleteFile: async (path: string) => {
        files.delete(path);
      },
    };
    const core = new Core({ fs, network: emptyNetwork(), appDataDir });

    await Promise.all(folders.map((path) => core.unimportFolder(path)));

    const saved = JSON.parse(await fs.readTextFile(userConfigPath(appDataDir))) as { folders: string[] };
    expect(saved.folders).toEqual([]);
  });
});
