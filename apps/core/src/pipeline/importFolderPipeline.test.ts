import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import type { NetworkPort } from "../ports/NetworkPort";
import { NoopLoggerAdapter } from "../adapters/ConsoleLoggerAdapter";
import { ImportFolderPipeline } from "./importFolderPipeline";
import { userConfigPath, metadataCachePath } from "./paths";
import { recognizeMediaFolder } from "./recognizeMediaFolder";
const mockRecognizeMediaFolder = recognizeMediaFolder as ReturnType<typeof vi.fn>;

vi.mock("./recognizeMediaFolder", () => ({
  recognizeMediaFolder: vi.fn(async () => {
    return { tvShow: undefined, movie: undefined };
  }),
}));

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

function emptyNetwork(): NetworkPort {
  return { fetch: vi.fn() as never };
}

function makePipeline(options: { seed?: Record<string, string>; appDataDir?: string } = {}) {
  const appDataDir = options.appDataDir ?? "/data/smm";
  const fs = inMemoryFs(options.seed);
  const network = emptyNetwork();
  const logger = new NoopLoggerAdapter();
  return {
    fs,
    network,
    pipeline: new ImportFolderPipeline({ fs, network, logger, appDataDir }),
    appDataDir,
  };
}

describe("ImportFolderPipeline", () => {
  it("adds the folder to userConfig, lists files, persists metadata", async () => {
    const mediaDir = "/m/My.Show";
    const { fs, pipeline, appDataDir } = makePipeline({
      seed: {
        "/m/My.Show/S01E01.mkv": "",
        "/m/My.Show/poster.jpg": "",
      },
    });

    const mm = await pipeline.run(mediaDir, "music");

    expect(mm.type).toBe("music-folder");
    expect(mm.mediaFolderPath).toBe(mediaDir);
    expect(mm.files?.sort()).toEqual(["/m/My.Show/S01E01.mkv", "/m/My.Show/poster.jpg"]);

    const savedConfig = JSON.parse((await fs.readTextFile(userConfigPath(appDataDir))) as string);
    expect(savedConfig.folders).toContain(mediaDir);

    const cached = JSON.parse((await fs.readTextFile(metadataCachePath(appDataDir, mediaDir))) as string);
    expect(cached.type).toBe("music-folder");
  });

  it("skipRegistration does not rewrite userConfig but still lists files and persists metadata", async () => {
    const mediaDir = "/m/My.Show";
    const { fs, pipeline, appDataDir } = makePipeline({
      seed: {
        "/m/My.Show/S01E01.mkv": "",
        [userConfigPath("/data/smm")]: JSON.stringify({ folders: [mediaDir], tmdb: {}, tvdb: {} }),
        [metadataCachePath("/data/smm", mediaDir)]: JSON.stringify({
          mediaFolderPath: mediaDir,
          type: "music-folder",
          mediaFiles: [],
        }),
      },
    });

    const stages: string[] = [];
    await pipeline.run(
      mediaDir,
      "music",
      {
        onStage: (stage) => {
          stages.push(stage ?? "null");
        },
      },
      { skipRegistration: true },
    );

    expect(stages).toEqual(["listFiles", "persist"]);
    const savedConfig = JSON.parse((await fs.readTextFile(userConfigPath(appDataDir))) as string);
    expect(savedConfig.folders).toEqual([mediaDir]);
    const cached = JSON.parse((await fs.readTextFile(metadataCachePath(appDataDir, mediaDir))) as string);
    expect(cached.mediaFiles).toEqual([]);
    expect(cached.type).toBe("music-folder");
  });

  it("dedupes an already-present folder in userConfig", async () => {
    const mediaDir = "/m/My.Show";
    const { fs, pipeline, appDataDir } = makePipeline({
      seed: { [userConfigPath("/data/smm")]: JSON.stringify({ folders: [mediaDir] }) },
    });

    await pipeline.run(mediaDir, "music");

    const savedConfig = JSON.parse((await fs.readTextFile(userConfigPath(appDataDir))) as string);
    expect(savedConfig.folders).toEqual([mediaDir]);
  });

  it("recognizes a tvshow and matches episodes via SXXEYY", async () => {
    const mediaDir = "/m/My.Show";
    const { pipeline } = makePipeline({
      seed: {
        "/m/My.Show/S01E01.mkv": "",
        "/m/My.Show/S01E02.mkv": "",
        "/m/My.Show/tvshow.nfo": "<tvshow><tmdbid>1</tmdbid></tvshow>",
      },
    });

    mockRecognizeMediaFolder.mockResolvedValue({
      tvShow: {
        database: "TMDB",
        id: "1",
        name: "My Show",
        seasons: [{ season: 1, name: "Season 1", episodes: [{ season: 1, episode: 1, name: "E1" }, { season: 1, episode: 2, name: "E2" }] }],
      },
    });

    const mm = await pipeline.run(mediaDir, "tvshow");

    expect(mm.tvShow?.database).toBe("TMDB");
    expect(mm.mediaFiles).toEqual([
      { absolutePath: "/m/My.Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 },
      { absolutePath: "/m/My.Show/S01E02.mkv", seasonNumber: 1, episodeNumber: 2 },
    ]);
  });
});
