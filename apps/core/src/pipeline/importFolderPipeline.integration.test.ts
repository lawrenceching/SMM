import { describe, expect, it, vi } from "vitest";
import { Path } from "@smm/utils/path";
import type { FsPort } from "../ports/FsPort";
import type { HttpResponse, NetworkPort } from "../ports/NetworkPort";
import { NoopLoggerAdapter } from "../adapters/ConsoleLoggerAdapter";
import { TmdbClient } from "../clients/TmdbClient";
import { TvdbClient } from "../clients/TvdbClient";
import {
  initializeFolder,
  persistNewFolder,
  type FolderInitializationDeps,
} from "./importFolderPipeline";
import { MediaMetadataHelper } from "./mediaMetadataHelper";
import { UserConfigHelper } from "./userConfigHelper";
import { metadataCachePath } from "./paths";

function jsonResponse(body: unknown): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve(JSON.stringify(body)),
    json: <T>() => Promise.resolve(body as T),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
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
    writeBinaryFile: vi.fn(async () => {}),
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
    mkdir: vi.fn(async () => {}),
    listSubdirectories: vi.fn(async () => []),
  };
}

describe("folder initialization integration", () => {
  it("runs the real recognizeMediaFolder: preferMediaLanguage + primaryDatabase flow into recognition, and the movie branch sets mediaFiles", async () => {
    const appDataDir = "/data/smm";
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

    const userConfig = new UserConfigHelper(fs, appDataDir);
    const mediaMetadata = new MediaMetadataHelper(fs, appDataDir);
    const config = await userConfig.read();
    const deps: FolderInitializationDeps = {
      fs,
      appDataDir,
      userConfig,
      mediaMetadata,
      normalizePosix: (path) => Path.posix(path),
      tmdb: new TmdbClient(network, { reverseProxyUrl: null }),
      tvdb: new TvdbClient(network, { reverseProxyUrl: null }),
      language: config.preferMediaLanguage ?? "en-US",
      primaryDatabase: config.primaryDatabase,
      logger: new NoopLoggerAdapter(),
    };

    await persistNewFolder("/m/My Film", "movie", deps);
    await initializeFolder("/m/My Film", "movie", deps);

    const cached = JSON.parse(
      await fs.readTextFile(metadataCachePath(appDataDir, "/m/My Film")),
    ) as Record<string, unknown>;
    expect(cached.movie).toMatchObject({ id: "2", name: "My Film", database: "TMDB" });
    expect(cached.mediaFiles).toEqual([{ absolutePath: "/m/My Film/my.video.mkv" }]);
  });
});
