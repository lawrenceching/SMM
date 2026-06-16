import { mkdir, mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GET_EPISODES_NOT_MANAGED,
  GET_EPISODES_NOT_TV_SHOW,
} from "@smm/core/types/ai-tools/getEpisodes";
import { LIST_FILES_IN_MEDIA_FOLDER_NOT_MANAGED } from "@smm/core/types/ai-tools/listFilesInMediaFolder";
import type { MediaMetadata } from "@smm/core/types";
import { Path } from "@smm/core/path";
import { metadataCacheFilePath } from "./mediaMetadataCache.ts";
import { doGetEpisodes } from "./getEpisodes.ts";
import { doListFilesInMediaFolder } from "./listFilesInMediaFolder.ts";
import type { CoreRoutesConfig } from "./types.ts";

describe("doGetEpisodes", () => {
  let root: string;
  let mediaDir: string;
  let config: CoreRoutesConfig;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "smm-core-routes-get-episodes-"));
    mediaDir = join(root, "show");
    await mkdir(mediaDir, { recursive: true });
    await writeFile(
      join(root, "smm.json"),
      JSON.stringify({ folders: [mediaDir] }),
      "utf-8",
    );
    config = {
      allowlist: [root.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1")],
      appDataDir: root,
      hello: { userDataDir: root, appDataDir: root } as CoreRoutesConfig["hello"],
    };
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns not managed when folder is outside user config", async () => {
    const result = await doGetEpisodes(
      { mediaFolderPath: join(root, "other-show") },
      config,
    );
    expect(result.error).toBe(GET_EPISODES_NOT_MANAGED);
  });

  it("returns not-a-tv-show when metadata has no tvShow", async () => {
    const metadata: MediaMetadata = {
      mediaFolderPath: mediaDir,
      type: "tvshow-folder",
    };
    const cachePath = metadataCacheFilePath(root, Path.posix(mediaDir));
    await mkdir(join(root, "metadata"), { recursive: true });
    await writeFile(cachePath, JSON.stringify(metadata), "utf-8");

    const result = await doGetEpisodes({ mediaFolderPath: mediaDir }, config);
    expect(result.error).toBe(GET_EPISODES_NOT_TV_SHOW);
  });

  it("returns episodes when metadata is a TV show", async () => {
    const metadata: MediaMetadata = {
      mediaFolderPath: mediaDir,
      type: "tvshow-folder",
      tvShow: {
        id: "1",
        name: "Demo",
        database: "TMDB",
        seasons: [
          {
            season: 1,
            name: "Season 1",
            episodes: [{ season: 1, episode: 1, name: "Pilot" }],
          },
        ],
      },
      mediaFiles: [
        {
          absolutePath: join(mediaDir, "S01E01.mkv"),
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };
    const cachePath = metadataCacheFilePath(root, Path.posix(mediaDir));
    await writeFile(cachePath, JSON.stringify(metadata), "utf-8");

    const result = await doGetEpisodes({ mediaFolderPath: mediaDir }, config);
    expect(result.error).toBeUndefined();
    expect(result.showName).toBe("Demo");
    expect(result.totalCount).toBe(1);
    expect(result.episodes[0]?.videoFilePath).toBeTruthy();
  });
});

describe("doListFilesInMediaFolder", () => {
  let root: string;
  let mediaDir: string;
  let config: CoreRoutesConfig;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "smm-core-routes-list-media-"));
    mediaDir = join(root, "media");
    await mkdir(mediaDir, { recursive: true });
    const fh = await open(join(mediaDir, "video.mkv"), "w");
    await fh.close();
    await writeFile(
      join(root, "smm.json"),
      JSON.stringify({ folders: [mediaDir] }),
      "utf-8",
    );
    config = {
      allowlist: [root.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1")],
      appDataDir: root,
      hello: { userDataDir: root, appDataDir: root } as CoreRoutesConfig["hello"],
    };
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns not managed for unknown folders", async () => {
    const result = await doListFilesInMediaFolder(
      { mediaFolderPath: join(root, "missing") },
      config,
    );
    expect(result.error).toBe(LIST_FILES_IN_MEDIA_FOLDER_NOT_MANAGED);
  });

  it("lists files in a managed media folder", async () => {
    const result = await doListFilesInMediaFolder(
      { mediaFolderPath: mediaDir, videoFileOnly: true },
      config,
    );
    expect(result.error).toBeUndefined();
    expect(result.count).toBe(1);
    expect(result.files[0]).toContain("video.mkv");
  });
});
