import { describe, expect, it, vi } from "vitest";
import { Path } from "@smm/utils/path";
import type { FsPort } from "../ports/FsPort";
import { NoopLoggerAdapter } from "../adapters/ConsoleLoggerAdapter";
import {
  initializeFolder,
  persistNewFolder,
  type FolderInitializationDeps,
} from "./importFolderPipeline";
import { MediaMetadataHelper } from "./mediaMetadataHelper";
import { UserConfigHelper } from "./userConfigHelper";
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

function makeDeps(seed: Record<string, string> = {}) {
  const appDataDir = "/data/smm";
  const fs = inMemoryFs(seed);
  const userConfig = new UserConfigHelper(fs, appDataDir);
  const mediaMetadata = new MediaMetadataHelper(fs, appDataDir);
  const deps: FolderInitializationDeps = {
    fs,
    appDataDir,
    userConfig,
    mediaMetadata,
    normalizePosix: (path) => Path.posix(path),
    tmdb: {} as FolderInitializationDeps["tmdb"],
    tvdb: {} as FolderInitializationDeps["tvdb"],
    language: "en-US",
    logger: new NoopLoggerAdapter(),
  };
  return { fs, appDataDir, deps };
}

async function readJson(fs: FsPort, path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readTextFile(path)) as Record<string, unknown>;
}

describe("persistNewFolder (stage 1)", () => {
  it("registers the folder in smm.json and writes blank metadata", async () => {
    const mediaDir = "/m/My.Show";
    const { fs, appDataDir, deps } = makeDeps({ "/m/My.Show/S01E01.mkv": "" });

    const blank = await persistNewFolder(mediaDir, "tvshow", deps);

    expect(blank).toEqual({
      mediaFolderPath: mediaDir,
      type: "tvshow-folder",
      mediaFiles: [],
    });
    const savedConfig = await readJson(fs, userConfigPath(appDataDir));
    expect(savedConfig.folders).toContain(mediaDir);
    expect(await readJson(fs, metadataCachePath(appDataDir, mediaDir))).toEqual({
      mediaFolderPath: mediaDir,
      type: "tvshow-folder",
      mediaFiles: [],
    });
  });

  it("dedupes an already-present folder in userConfig", async () => {
    const mediaDir = "/m/My.Show";
    const { fs, appDataDir, deps } = makeDeps({
      [userConfigPath("/data/smm")]: JSON.stringify({ folders: [mediaDir] }),
    });

    await persistNewFolder(mediaDir, "music", deps);

    const savedConfig = await readJson(fs, userConfigPath(appDataDir));
    expect(savedConfig.folders).toEqual([mediaDir]);
  });

});

describe("initializeFolder (stages 2 and 3)", () => {
  it("invokes throwIfAborted before recognizeFolder", async () => {
    const { deps } = makeDeps({ "/m/Show/S01E01.mkv": "" });
    const throwIfAborted = vi.fn(() => {
      throw new Error("stopped");
    });

    await expect(
      initializeFolder("/m/Show", "tvshow", deps, { throwIfAborted }),
    ).rejects.toThrow("stopped");

    expect(mockRecognizeMediaFolder).not.toHaveBeenCalled();
  });

  it("skips recognition for music folders", async () => {
    const mediaDir = "/m/My.Music";
    const { deps } = makeDeps({ "/m/My.Music/a.mp3": "" });
    await persistNewFolder(mediaDir, "music", deps);
    mockRecognizeMediaFolder.mockClear();

    const stages: (string | null)[] = [];
    await initializeFolder(mediaDir, "music", deps, {
      onStage: (stage) => stages.push(stage),
    });

    expect(mockRecognizeMediaFolder).not.toHaveBeenCalled();
    expect(stages).toEqual([]);
  });

  it("fails when the folder cannot be listed, even for music", async () => {
    const mediaDir = "/m/Missing";
    const { fs, deps } = makeDeps();
    await persistNewFolder(mediaDir, "music", deps);
    vi.mocked(fs.listFiles).mockRejectedValueOnce(new Error(`ENOENT: ${mediaDir}`));

    await expect(initializeFolder(mediaDir, "music", deps)).rejects.toThrow("ENOENT");
  });

  it("recognizes a tvshow and matches episodes via SXXEYY", async () => {
    const mediaDir = "/m/My.Show";
    const { fs, appDataDir, deps } = makeDeps({
      "/m/My.Show/S01E01.mkv": "",
      "/m/My.Show/S01E02.mkv": "",
      "/m/My.Show/tvshow.nfo": "<tvshow><tmdbid>1</tmdbid></tvshow>",
    });
    await persistNewFolder(mediaDir, "tvshow", deps);
    mockRecognizeMediaFolder.mockResolvedValue({
      tvShow: {
        database: "TMDB",
        id: "1",
        name: "My Show",
        seasons: [
          {
            season: 1,
            name: "Season 1",
            episodes: [
              { season: 1, episode: 1, name: "E1" },
              { season: 1, episode: 2, name: "E2" },
            ],
          },
        ],
      },
    });

    const stages: (string | null)[] = [];
    let recognizedTitle: string | undefined;
    await initializeFolder(mediaDir, "tvshow", deps, {
      onStage: (stage, _progress, detail) => {
        stages.push(stage);
        if (detail?.title !== undefined) recognizedTitle = detail.title;
      },
    });

    expect(stages).toEqual(["recognizeFolder", "recognizeEpisodes"]);
    expect(recognizedTitle).toBe("My Show");
    const cached = await readJson(fs, metadataCachePath(appDataDir, mediaDir));
    expect((cached.tvShow as { database: string }).database).toBe("TMDB");
    expect(cached.mediaFiles).toEqual([
      { absolutePath: "/m/My.Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 },
      { absolutePath: "/m/My.Show/S01E02.mkv", seasonNumber: 1, episodeNumber: 2 },
    ]);
  });

  it("links the first video file of a recognized movie folder", async () => {
    const mediaDir = "/m/My Film";
    const { fs, appDataDir, deps } = makeDeps({
      "/m/My Film/cover.jpg": "",
      "/m/My Film/my.video.mkv": "",
    });
    await persistNewFolder(mediaDir, "movie", deps);
    mockRecognizeMediaFolder.mockResolvedValue({
      movie: { database: "TMDB", id: "2", name: "My Film" },
    });

    await initializeFolder(mediaDir, "movie", deps);

    const cached = await readJson(fs, metadataCachePath(appDataDir, mediaDir));
    expect(cached.mediaFiles).toEqual([{ absolutePath: "/m/My Film/my.video.mkv" }]);
  });

  it("leaves metadata blank when nothing is recognized", async () => {
    const mediaDir = "/m/Unknown.Show";
    const { fs, appDataDir, deps } = makeDeps({ "/m/Unknown.Show/S01E01.mkv": "" });
    await persistNewFolder(mediaDir, "tvshow", deps);
    mockRecognizeMediaFolder.mockResolvedValue({ tvShow: undefined, movie: undefined });

    await initializeFolder(mediaDir, "tvshow", deps);

    expect(await readJson(fs, metadataCachePath(appDataDir, mediaDir))).toEqual({
      mediaFolderPath: mediaDir,
      type: "tvshow-folder",
      mediaFiles: [],
    });
  });
});
