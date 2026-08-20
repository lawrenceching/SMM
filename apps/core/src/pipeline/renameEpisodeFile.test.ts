import { describe, expect, it, vi } from "vitest";
import type { MediaMetadata } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import { metadataCachePath, userConfigPath } from "./paths";
import { renameEpisodeFilePipeline } from "./renameEpisodeFile";
import { UserConfig } from "./userConfig";

const appDataDir = "/app";
const folder = "/m/Show";

function configWith(folders: string[]): string {
  return JSON.stringify({
    folders,
    tmdb: {},
    tvdb: {},
    renameRules: [],
    dryRun: false,
    selectedRenameRule: "plex",
  });
}

function tvMetadata(overrides: Partial<MediaMetadata> = {}): MediaMetadata {
  return {
    mediaFolderPath: folder,
    type: "tvshow-folder",
    mediaFiles: [
      {
        absolutePath: "/m/Show/S01E01.mp4",
        seasonNumber: 1,
        episodeNumber: 1,
      },
    ],
    tvShow: {
      database: "TMDB",
      id: "1",
      name: "Demo",
      seasons: [
        {
          season: 1,
          name: "Season 1",
          episodes: [{ season: 1, episode: 1, name: "Pilot" }],
        },
      ],
    },
    ...overrides,
  };
}

function createFs(seed: Record<string, string>): FsPort & {
  textFiles: Map<string, string>;
} {
  const textFiles = new Map<string, string>(Object.entries(seed));
  return {
    textFiles,
    readTextFile: vi.fn(async (path: string) => {
      const v = textFiles.get(path);
      if (v === undefined) throw new Error("ENOENT: " + path);
      return v;
    }),
    writeTextFile: vi.fn(async (path: string, content: string) => {
      textFiles.set(path, content);
    }),
    writeBinaryFile: vi.fn(async () => {}),
    exists: vi.fn(async (path: string) => textFiles.has(path)),
    listFiles: vi.fn(async (dir: string) =>
      [...textFiles.keys()].filter((k) => k.startsWith(dir + "/") && !k.endsWith("/")),
    ),
    deleteFile: vi.fn(async (path: string) => {
      textFiles.delete(path);
    }),
    rename: vi.fn(async (from: string, to: string) => {
      const content = textFiles.get(from);
      if (content === undefined) throw new Error("ENOENT: " + from);
      textFiles.delete(from);
      textFiles.set(to, content);
    }),
    mkdir: vi.fn(async () => {}),
  };
}

function managedFs(extraFiles: Record<string, string> = {}, mm: MediaMetadata = tvMetadata()) {
  const fs = createFs({
    [userConfigPath(appDataDir)]: configWith([folder]),
    [metadataCachePath(appDataDir, folder)]: JSON.stringify(mm),
    ...extraFiles,
  });
  return { fs, userConfig: new UserConfig(fs, appDataDir), mm };
}

function baseDeps(
  fs: FsPort,
  userConfig: UserConfig,
  mm: MediaMetadata | null,
  setMetadata: (next: MediaMetadata) => Promise<void> = async () => {},
) {
  return {
    fs,
    appDataDir,
    userConfig,
    normalizePosix: (p: string) => p,
    getMediaMetadata: async () => mm,
    setMetadata,
  };
}

describe("renameEpisodeFilePipeline", () => {
  it("renames episode + associates and updates metadata", async () => {
    const mm = tvMetadata();
    const fs = createFs({
      [userConfigPath(appDataDir)]: configWith([folder]),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(mm),
      "/m/Show/S01E01.mp4": "video",
      "/m/Show/S01E01.srt": "sub",
      "/m/Show/S01E01.en.srt": "en",
    });
    const userConfig = new UserConfig(fs, appDataDir);

    const result = await renameEpisodeFilePipeline(
      {
        mediaFolderPath: folder,
        from: "/m/Show/S01E01.mp4",
        to: "/m/Show/S01E01_renamed.mp4",
      },
      {
        fs,
        appDataDir,
        userConfig,
        normalizePosix: (p) => p,
        getMediaMetadata: async () => mm,
        setMetadata: async (next) => {
          await fs.writeTextFile(metadataCachePath(appDataDir, folder), JSON.stringify(next));
        },
      },
    );

    expect(result.failed).toEqual([]);
    expect(result.succeeded).toEqual([
      { from: "/m/Show/S01E01.mp4", to: "/m/Show/S01E01_renamed.mp4" },
      { from: "/m/Show/S01E01.srt", to: "/m/Show/S01E01_renamed.srt" },
      { from: "/m/Show/S01E01.en.srt", to: "/m/Show/S01E01_renamed.en.srt" },
    ]);
    expect(fs.textFiles.has("/m/Show/S01E01_renamed.mp4")).toBe(true);
    expect(fs.textFiles.has("/m/Show/S01E01.mp4")).toBe(false);

    const saved = JSON.parse(
      fs.textFiles.get(metadataCachePath(appDataDir, folder))!,
    ) as MediaMetadata;
    expect(saved.mediaFiles?.[0]?.absolutePath).toBe("/m/Show/S01E01_renamed.mp4");
  });

  it("rejects unlinked files", async () => {
    const mm = tvMetadata();
    const fs = createFs({
      [userConfigPath(appDataDir)]: configWith([folder]),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(mm),
      "/m/Show/orphan.mp4": "x",
    });
    const userConfig = new UserConfig(fs, appDataDir);

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/m/Show/orphan.mp4",
          to: "/m/Show/orphan2.mp4",
        },
        {
          fs,
          appDataDir,
          userConfig,
          normalizePosix: (p) => p,
          getMediaMetadata: async () => mm,
          setMetadata: async () => {},
        },
      ),
    ).rejects.toThrow(/not a linked episode/i);
  });

  it("rejects movie folders", async () => {
    const mm = tvMetadata({ type: "movie-folder", mediaFiles: [{ absolutePath: "/m/Show/movie.mkv" }] });
    const fs = createFs({
      [userConfigPath(appDataDir)]: configWith([folder]),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(mm),
      "/m/Show/movie.mkv": "x",
    });
    const userConfig = new UserConfig(fs, appDataDir);

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/m/Show/movie.mkv",
          to: "/m/Show/movie2.mkv",
        },
        {
          fs,
          appDataDir,
          userConfig,
          normalizePosix: (p) => p,
          getMediaMetadata: async () => mm,
          setMetadata: async () => {},
        },
      ),
    ).rejects.toThrow(/not a TV show/i);
  });

  it("rejects unmanaged folders", async () => {
    const mm = tvMetadata();
    const fs = createFs({
      [userConfigPath(appDataDir)]: configWith([]),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(mm),
      "/m/Show/S01E01.mp4": "video",
    });
    const userConfig = new UserConfig(fs, appDataDir);

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/m/Show/S01E01.mp4",
          to: "/m/Show/S01E01_renamed.mp4",
        },
        {
          fs,
          appDataDir,
          userConfig,
          normalizePosix: (p) => p,
          getMediaMetadata: async () => mm,
          setMetadata: async () => {},
        },
      ),
    ).rejects.toThrow(/not managed by SMM/i);
  });

  it("refuses when destination already exists (no renames)", async () => {
    const mm = tvMetadata();
    const fs = createFs({
      [userConfigPath(appDataDir)]: configWith([folder]),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(mm),
      "/m/Show/S01E01.mp4": "video",
      "/m/Show/S01E01_renamed.mp4": "already",
    });
    const userConfig = new UserConfig(fs, appDataDir);
    const rename = vi.fn(fs.rename);

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/m/Show/S01E01.mp4",
          to: "/m/Show/S01E01_renamed.mp4",
        },
        {
          fs: { ...fs, rename },
          appDataDir,
          userConfig,
          normalizePosix: (p) => p,
          getMediaMetadata: async () => mm,
          setMetadata: async () => {},
        },
      ),
    ).rejects.toThrow(/already exists/i);

    expect(rename).not.toHaveBeenCalled();
    expect(fs.textFiles.has("/m/Show/S01E01.mp4")).toBe(true);
  });

  it("refuses when source is missing (no renames)", async () => {
    const mm = tvMetadata();
    const fs = createFs({
      [userConfigPath(appDataDir)]: configWith([folder]),
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(mm),
    });
    const userConfig = new UserConfig(fs, appDataDir);
    const rename = vi.fn(fs.rename);

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/m/Show/S01E01.mp4",
          to: "/m/Show/S01E01_renamed.mp4",
        },
        {
          fs: { ...fs, rename },
          appDataDir,
          userConfig,
          normalizePosix: (p) => p,
          getMediaMetadata: async () => mm,
          setMetadata: async () => {},
        },
      ),
    ).rejects.toThrow(/does not exist/i);

    expect(rename).not.toHaveBeenCalled();
  });

  it("rejects empty mediaFolder / from / to", async () => {
    const { fs, userConfig, mm } = managedFs({ "/m/Show/S01E01.mp4": "video" });
    const deps = baseDeps(fs, userConfig, mm);

    await expect(
      renameEpisodeFilePipeline(
        { mediaFolderPath: "  ", from: "/m/Show/S01E01.mp4", to: "/m/Show/x.mp4" },
        deps,
      ),
    ).rejects.toThrow(/mediaFolder is required/i);

    await expect(
      renameEpisodeFilePipeline(
        { mediaFolderPath: folder, from: "", to: "/m/Show/x.mp4" },
        deps,
      ),
    ).rejects.toThrow(/from is required/i);

    await expect(
      renameEpisodeFilePipeline(
        { mediaFolderPath: folder, from: "/m/Show/S01E01.mp4", to: "   " },
        deps,
      ),
    ).rejects.toThrow(/to is required/i);
  });

  it("rejects when from and to are the same path", async () => {
    const { fs, userConfig, mm } = managedFs({ "/m/Show/S01E01.mp4": "video" });

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/m/Show/S01E01.mp4",
          to: "/m/Show/S01E01.mp4",
        },
        baseDeps(fs, userConfig, mm),
      ),
    ).rejects.toThrow(/from and to must differ/i);
  });

  it("rejects when media metadata is missing", async () => {
    const { fs, userConfig } = managedFs({ "/m/Show/S01E01.mp4": "video" });

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/m/Show/S01E01.mp4",
          to: "/m/Show/S01E01_renamed.mp4",
        },
        baseDeps(fs, userConfig, null),
      ),
    ).rejects.toThrow(/Media metadata not found/i);
  });

  it("rejects when from is outside the media folder", async () => {
    const mm = tvMetadata({
      mediaFiles: [
        {
          absolutePath: "/other/S01E01.mp4",
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    });
    const { fs, userConfig } = managedFs({ "/other/S01E01.mp4": "video" }, mm);

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/other/S01E01.mp4",
          to: "/m/Show/S01E01.mp4",
        },
        baseDeps(fs, userConfig, mm),
      ),
    ).rejects.toThrow(/outside media folder/i);
  });

  it("rejects when to is outside the media folder", async () => {
    const { fs, userConfig, mm } = managedFs({ "/m/Show/S01E01.mp4": "video" });

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/m/Show/S01E01.mp4",
          to: "/other/S01E01.mp4",
        },
        baseDeps(fs, userConfig, mm),
      ),
    ).rejects.toThrow(/outside media folder/i);
  });

  it("rejects mediaFiles entry missing season or episode numbers", async () => {
    const mm = tvMetadata({
      mediaFiles: [{ absolutePath: "/m/Show/S01E01.mp4", seasonNumber: 1 }],
    });
    const { fs, userConfig } = managedFs({ "/m/Show/S01E01.mp4": "video" }, mm);

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/m/Show/S01E01.mp4",
          to: "/m/Show/S01E01_renamed.mp4",
        },
        baseDeps(fs, userConfig, mm),
      ),
    ).rejects.toThrow(/not a linked episode/i);
  });

  it("renames only the primary file when there are no associates", async () => {
    const { fs, userConfig, mm } = managedFs({ "/m/Show/S01E01.mp4": "video" });
    const setMetadata = vi.fn(async () => {});

    const result = await renameEpisodeFilePipeline(
      {
        mediaFolderPath: folder,
        from: "/m/Show/S01E01.mp4",
        to: "/m/Show/S01E01_renamed.mp4",
      },
      baseDeps(fs, userConfig, mm, setMetadata),
    );

    expect(result.failed).toEqual([]);
    expect(result.succeeded).toEqual([
      { from: "/m/Show/S01E01.mp4", to: "/m/Show/S01E01_renamed.mp4" },
    ]);
    expect(setMetadata).toHaveBeenCalledOnce();
  });

  it("refuses when an associate destination already exists (no renames)", async () => {
    const { fs, userConfig, mm } = managedFs({
      "/m/Show/S01E01.mp4": "video",
      "/m/Show/S01E01.srt": "sub",
      "/m/Show/S01E01_renamed.srt": "taken",
    });
    const rename = vi.fn(fs.rename);

    await expect(
      renameEpisodeFilePipeline(
        {
          mediaFolderPath: folder,
          from: "/m/Show/S01E01.mp4",
          to: "/m/Show/S01E01_renamed.mp4",
        },
        baseDeps({ ...fs, rename }, userConfig, mm),
      ),
    ).rejects.toThrow(/already exists/i);

    expect(rename).not.toHaveBeenCalled();
    expect(fs.textFiles.has("/m/Show/S01E01.mp4")).toBe(true);
    expect(fs.textFiles.has("/m/Show/S01E01.srt")).toBe(true);
  });

  it("creates parent dir when renaming into a subdirectory", async () => {
    const { fs, userConfig, mm } = managedFs({ "/m/Show/S01E01.mp4": "video" });

    const result = await renameEpisodeFilePipeline(
      {
        mediaFolderPath: folder,
        from: "/m/Show/S01E01.mp4",
        to: "/m/Show/Season 01/S01E01.mp4",
      },
      baseDeps(fs, userConfig, mm),
    );

    expect(result.failed).toEqual([]);
    expect(result.succeeded).toEqual([
      { from: "/m/Show/S01E01.mp4", to: "/m/Show/Season 01/S01E01.mp4" },
    ]);
    expect(fs.mkdir).toHaveBeenCalledWith("/m/Show/Season 01");
    expect(fs.textFiles.has("/m/Show/Season 01/S01E01.mp4")).toBe(true);
  });

  it("records partial failures and still updates metadata for succeeded renames", async () => {
    const { fs, userConfig, mm } = managedFs({
      "/m/Show/S01E01.mp4": "video",
      "/m/Show/S01E01.srt": "sub",
    });
    const setMetadata = vi.fn(async () => {});
    const rename = vi.fn(async (from: string, to: string) => {
      if (from.endsWith(".srt")) {
        throw new Error("EACCES: subtitle locked");
      }
      const content = fs.textFiles.get(from);
      if (content === undefined) throw new Error("ENOENT: " + from);
      fs.textFiles.delete(from);
      fs.textFiles.set(to, content);
    });

    const result = await renameEpisodeFilePipeline(
      {
        mediaFolderPath: folder,
        from: "/m/Show/S01E01.mp4",
        to: "/m/Show/S01E01_renamed.mp4",
      },
      baseDeps({ ...fs, rename }, userConfig, mm, setMetadata),
    );

    expect(result.succeeded).toEqual([
      { from: "/m/Show/S01E01.mp4", to: "/m/Show/S01E01_renamed.mp4" },
    ]);
    expect(result.failed).toEqual([
      { path: "/m/Show/S01E01.srt", error: "EACCES: subtitle locked" },
    ]);
    expect(setMetadata).toHaveBeenCalledOnce();
    const saved = setMetadata.mock.calls[0]![0] as MediaMetadata;
    expect(saved.mediaFiles?.[0]?.absolutePath).toBe("/m/Show/S01E01_renamed.mp4");
  });

  it("does not call setMetadata when every rename fails", async () => {
    const { fs, userConfig, mm } = managedFs({ "/m/Show/S01E01.mp4": "video" });
    const setMetadata = vi.fn(async () => {});
    const rename = vi.fn(async () => {
      throw new Error("EIO: disk error");
    });

    const result = await renameEpisodeFilePipeline(
      {
        mediaFolderPath: folder,
        from: "/m/Show/S01E01.mp4",
        to: "/m/Show/S01E01_renamed.mp4",
      },
      baseDeps({ ...fs, rename }, userConfig, mm, setMetadata),
    );

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([
      { path: "/m/Show/S01E01.mp4", error: "EIO: disk error" },
    ]);
    expect(setMetadata).not.toHaveBeenCalled();
  });
});
