import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import type { HttpResponse, NetworkPort } from "../ports/NetworkPort";
import { NoopLoggerAdapter } from "../adapters/ConsoleLoggerAdapter";
import { ImportFolderPipeline } from "./importFolderPipeline";

function jsonResponse(body: unknown): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve(JSON.stringify(body)),
    json: <T>() => Promise.resolve(body as T),
  };
}

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
    deleteFile: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
  };
}

describe("ImportFolderPipeline integration", () => {
  it("runs the real recognizeMediaFolder: preferMediaLanguage + primaryDatabase flow into recognition, and the movie branch sets mediaFiles", async () => {
    const fs = inMemoryFs({
      "/data/smm/smm.json": JSON.stringify({ preferMediaLanguage: "en-US", primaryDatabase: "TMDB" }),
      "/m/My Film/my.video.mkv": "",
      "/m/My Film/cover.jpg": "",
    });
    const network: NetworkPort = {
      fetch: async (url: string) => {
        if (url.includes("/search/movie")) {
          if (!url.includes("language=en-US")) throw new Error("wrong language: " + url);
          return jsonResponse({
            results: [{ id: 2, title: "My Film" }],
            page: 1,
            total_pages: 1,
            total_results: 1,
          });
        }
        throw new Error("unexpected url: " + url);
      },
    };
    const pipeline = new ImportFolderPipeline({
      fs,
      network,
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });

    const result = await pipeline.run("/m/My Film", "movie");

    expect(result.movie).toMatchObject({ id: "2", name: "My Film", database: "TMDB" });
    expect(result.mediaFiles).toEqual([{ absolutePath: "/m/My Film/my.video.mkv" }]);
  });
});
