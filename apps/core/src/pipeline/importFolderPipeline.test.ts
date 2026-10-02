import { describe, expect, it, vi } from "vitest";
import { Path } from "@smm/utils/path";
import type { FsPort } from "../ports/FsPort";
import { NoopLoggerAdapter } from "../adapters/ConsoleLoggerAdapter";
import {
  recognizedEpisodeFilesMessage,
  recognizedFolderMessage,
  STARTED_RECOGNIZE_EPISODES,
  STARTED_RECOGNIZE_FOLDER,
} from "../jobs/importFolderLog";
import {
  initializeFolder,
  persistNewFolder,
  type FolderInitializationDeps,
} from "./importFolderPipeline";
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
  const deps: FolderInitializationDeps = {
    fs,
    network: { fetch: vi.fn() },
    appDataDir,
    userDataDir: appDataDir,
    osLocale: "en-US",
    normalizePosix: (path) => Path.posix(path),
    logger: new NoopLoggerAdapter(),
  };
  const ctx = {
    appDataDir,
    userDataDir: appDataDir,
    osLocale: "en-US",
  };
  const ports = {
    fs: deps.fs,
    network: deps.network,
    logger: deps.logger,
    normalizePosix: deps.normalizePosix,
  };
  return { fs, appDataDir, deps, ctx, ports };
}

async function readJson(fs: FsPort, path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readTextFile(path)) as Record<string, unknown>;
}

describe("persistNewFolder (stage 1)", () => {
  it("registers the folder in smm.json and writes blank metadata", async () => {
    const mediaDir = "/m/My.Show";
    const { fs, appDataDir, ctx, ports } = makeDeps({ "/m/My.Show/S01E01.mkv": "" });

    const blank = await persistNewFolder(mediaDir, "tvshow", ctx, ports);

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
    const { fs, appDataDir, ctx, ports } = makeDeps({
      [userConfigPath("/data/smm")]: JSON.stringify({ folders: [mediaDir] }),
    });

    await persistNewFolder(mediaDir, "music", ctx, ports);

    const savedConfig = await readJson(fs, userConfigPath(appDataDir));
    expect(savedConfig.folders).toEqual([mediaDir]);
  });

  it("skips rewriting smm.json when the folder is already registered", async () => {
    const mediaDir = "/m/My.Show";
    const configPath = userConfigPath("/data/smm");
    const { fs, ctx, ports } = makeDeps({
      [configPath]: JSON.stringify({ folders: [mediaDir] }),
    });
    vi.mocked(fs.writeTextFile).mockClear();

    await persistNewFolder(mediaDir, "tvshow", ctx, ports);

    const configWrites = vi.mocked(fs.writeTextFile).mock.calls.filter(([path]) => path === configPath);
    expect(configWrites).toHaveLength(0);
  });

  it("preserves existing metadata instead of overwriting with blank", async () => {
    const mediaDir = "/m/My.Show";
    const existing = {
      mediaFolderPath: mediaDir,
      type: "tvshow-folder",
      mediaFiles: [{ path: `${mediaDir}/S01E01.mkv`, episode: { season: 1, episode: 1 } }],
      tvShow: { database: "TMDB", id: "1", name: "My Show" },
    };
    const { fs, appDataDir, ctx, ports } = makeDeps({
      [userConfigPath("/data/smm")]: JSON.stringify({ folders: [mediaDir] }),
      [metadataCachePath("/data/smm", mediaDir)]: JSON.stringify(existing),
    });

    const result = await persistNewFolder(mediaDir, "tvshow", ctx, ports);

    expect(result).toEqual(existing);
    expect(await readJson(fs, metadataCachePath(appDataDir, mediaDir))).toEqual(existing);
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
    const { deps, ctx, ports } = makeDeps({ "/m/My.Music/a.mp3": "" });
    await persistNewFolder(mediaDir, "music", ctx, ports);
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
    const { fs, deps, ctx, ports } = makeDeps();
    await persistNewFolder(mediaDir, "music", ctx, ports);
    vi.mocked(fs.listFiles).mockRejectedValueOnce(new Error(`ENOENT: ${mediaDir}`));

    await expect(initializeFolder(mediaDir, "music", deps)).rejects.toThrow("ENOENT");
  });

  it("recognizes a tvshow and matches episodes via SXXEYY", async () => {
    const mediaDir = "/m/My.Show";
    const { fs, appDataDir, deps, ctx, ports } = makeDeps({
      "/m/My.Show/S01E01.mkv": "",
      "/m/My.Show/S01E02.mkv": "",
      "/m/My.Show/tvshow.nfo": "<tvshow><tmdbid>1</tmdbid></tvshow>",
    });
    await persistNewFolder(mediaDir, "tvshow", ctx, ports);
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

  it("logs how many episode files were recognized and how many episodes were not", async () => {
    const mediaDir = "/m/My.Show";
    const { deps, ctx, ports } = makeDeps({
      "/m/My.Show/S01E01.mkv": "",
      "/m/My.Show/notes.txt": "",
    });
    await persistNewFolder(mediaDir, "tvshow", ctx, ports);
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

    const messages: string[] = [];
    await initializeFolder(mediaDir, "tvshow", deps, {
      appendLog: (_level, message) => {
        messages.push(message);
      },
    });

    expect(messages).toEqual([
      STARTED_RECOGNIZE_FOLDER,
      recognizedFolderMessage("My Show"),
      STARTED_RECOGNIZE_EPISODES,
      recognizedEpisodeFilesMessage(1, 1),
    ]);
  });

  it("links the first video file of a recognized movie folder", async () => {
    const mediaDir = "/m/My Film";
    const { fs, appDataDir, deps, ctx, ports } = makeDeps({
      "/m/My Film/cover.jpg": "",
      "/m/My Film/my.video.mkv": "",
    });
    await persistNewFolder(mediaDir, "movie", ctx, ports);
    mockRecognizeMediaFolder.mockResolvedValue({
      movie: { database: "TMDB", id: "2", name: "My Film" },
    });

    await initializeFolder(mediaDir, "movie", deps);

    const cached = await readJson(fs, metadataCachePath(appDataDir, mediaDir));
    expect(cached.mediaFiles).toEqual([{ absolutePath: "/m/My Film/my.video.mkv" }]);
  });

  it("leaves metadata blank when nothing is recognized", async () => {
    const mediaDir = "/m/Unknown.Show";
    const { fs, appDataDir, deps, ctx, ports } = makeDeps({ "/m/Unknown.Show/S01E01.mkv": "" });
    await persistNewFolder(mediaDir, "tvshow", ctx, ports);
    mockRecognizeMediaFolder.mockResolvedValue({ tvShow: undefined, movie: undefined });

    await initializeFolder(mediaDir, "tvshow", deps);

    expect(await readJson(fs, metadataCachePath(appDataDir, mediaDir))).toEqual({
      mediaFolderPath: mediaDir,
      type: "tvshow-folder",
      mediaFiles: [],
    });
  });
});
