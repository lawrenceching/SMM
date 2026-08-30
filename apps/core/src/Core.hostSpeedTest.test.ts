import { describe, expect, it, vi } from "vitest";
import { StaticDiscoverAdapter } from "./adapters/StaticDiscoverAdapter";
import { NoopLoggerAdapter } from "./adapters/ConsoleLoggerAdapter";
import { Core } from "./Core";
import type { FsPort } from "./ports/FsPort";
import type { HttpResponse, NetworkPort } from "./ports/NetworkPort";

function inMemoryFs(): FsPort {
  const files = new Map<string, string>();
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
    listSubdirectories: vi.fn(async () => []),
    mkdir: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
    deleteFile: vi.fn(async () => {}),
  };
}

function jsonOk(): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve("{}"),
    json: <T>() => Promise.resolve({} as T),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  };
}

describe("Core host speed tests", () => {
  it("leaves performance lists empty when speed tests are not run (CLI)", async () => {
    const fetch = vi.fn(async () => jsonOk());
    const core = new Core({
      fs: inMemoryFs(),
      network: { fetch },
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
      discover: new StaticDiscoverAdapter(),
    });

    expect(core.getHostPerformanceList("tmdb")).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("records reachable hosts and omits TCP failures after runHostSpeedTests", async () => {
    const network: NetworkPort = {
      fetch: async (url) => {
        if (url.includes("tencentscf.com")) throw new Error("ECONNREFUSED");
        return jsonOk();
      },
    };
    const core = new Core({
      fs: inMemoryFs(),
      network,
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
      discover: new StaticDiscoverAdapter(),
    });

    await core.runHostSpeedTests();

    const tmdb = core.getHostPerformanceList("tmdb");
    expect(tmdb.length).toBeGreaterThan(0);
    expect(tmdb.every((entry) => !entry.host.includes("tencentscf.com"))).toBe(true);
    expect(tmdb.every((entry) => entry.score >= 0)).toBe(true);
  });
});
