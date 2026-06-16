import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Path } from "@smm/core/path";
import type { MediaMetadata } from "@smm/core/types";
import { metadataCacheFilePath } from "./mediaMetadataCache.ts";
import { doRenameFolder } from "./renameFolder.ts";
import type { CoreRoutesConfig } from "./types.ts";

describe("doRenameFolder", () => {
  let root: string;
  let fromDir: string;
  let toDir: string;
  let config: CoreRoutesConfig;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "smm-core-routes-rename-folder-"));
    fromDir = join(root, "show");
    toDir = join(root, "show-renamed");
    await mkdir(fromDir, { recursive: true });

    const metadata: MediaMetadata = {
      mediaFolderPath: Path.posix(fromDir),
      type: "tvshow-folder",
      files: [Path.posix(join(fromDir, "S01E01.mkv"))],
      mediaFiles: [
        {
          absolutePath: Path.posix(join(fromDir, "S01E01.mkv")),
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };

    await mkdir(join(root, "metadata"), { recursive: true });
    await writeFile(
      metadataCacheFilePath(root, Path.posix(fromDir)),
      JSON.stringify(metadata),
      "utf-8",
    );
    await writeFile(
      join(root, "smm.json"),
      JSON.stringify({ folders: [fromDir] }),
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

  it("returns error when source folder is not managed", async () => {
    const result = await doRenameFolder(
      {
        from: Path.posix(join(root, "other")),
        to: Path.posix(toDir),
      },
      config,
    );
    expect(result.error).toContain("not managed by SMM");
  });

  it("renames folder, metadata cache, and user config", async () => {
    const result = await doRenameFolder(
      {
        from: Path.posix(fromDir),
        to: Path.posix(toDir),
      },
      config,
    );

    expect(result.error).toBeUndefined();

    const userConfig = JSON.parse(
      await readFile(join(root, "smm.json"), "utf-8"),
    ) as { folders: string[] };
    expect(userConfig.folders).toContain(toDir);

    const newMetadata = JSON.parse(
      await readFile(metadataCacheFilePath(root, Path.posix(toDir)), "utf-8"),
    ) as MediaMetadata;
    expect(newMetadata.mediaFolderPath).toBe(Path.posix(toDir));

    await expect(access(fromDir)).rejects.toThrow();
    await expect(access(toDir)).resolves.toBeUndefined();
  });
});
