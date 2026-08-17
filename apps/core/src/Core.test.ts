import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "./ports/FsPort";
import type { NetworkPort } from "./ports/NetworkPort";
import { NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { Core } from "./Core";
import { userConfigPath } from "./pipeline/paths";

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
