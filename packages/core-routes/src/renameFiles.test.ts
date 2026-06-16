import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Path } from "@smm/core/path";
import type { MediaMetadata } from "@smm/core/types";
import { metadataCacheFilePath } from "./mediaMetadataCache.ts";
import { doRenameFiles } from "./renameFiles.ts";
import type { CoreRoutesConfig } from "./types.ts";

describe("doRenameFiles", () => {
  let root: string;
  let mediaDir: string;
  let config: CoreRoutesConfig;
  const broadcast = vi.fn();

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "smm-core-routes-rename-files-"));
    mediaDir = join(root, "show");
    await mkdir(mediaDir, { recursive: true });

    const fromFile = join(mediaDir, "ep1.mkv");
    const toFile = join(mediaDir, "S01E01.mkv");
    await writeFile(fromFile, "video");

    const metadata: MediaMetadata = {
      mediaFolderPath: Path.posix(mediaDir),
      type: "tvshow-folder",
      files: [Path.posix(fromFile)],
      mediaFiles: [
        {
          absolutePath: Path.posix(fromFile),
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };

    await mkdir(join(root, "metadata"), { recursive: true });
    await writeFile(
      metadataCacheFilePath(root, Path.posix(mediaDir)),
      JSON.stringify(metadata),
      "utf-8",
    );
    await writeFile(
      join(root, "smm.json"),
      JSON.stringify({ folders: [mediaDir] }),
      "utf-8",
    );

    config = {
      allowlist: [root.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1")],
      appDataDir: root,
      hello: { userDataDir: root, appDataDir: root } as CoreRoutesConfig["hello"],
      broadcast,
    };
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("renames files and updates metadata cache", async () => {
    broadcast.mockClear();
    const fromFile = join(mediaDir, "ep1.mkv");
    const toFile = join(mediaDir, "S01E01.mkv");

    const result = await doRenameFiles(
      {
        files: [{ from: fromFile, to: toFile }],
        mediaFolder: Path.posix(mediaDir),
      },
      config,
    );

    expect(result.error).toBeUndefined();
    expect(result.data?.succeeded).toEqual([Path.posix(fromFile)]);
    expect(result.data?.failed).toEqual([]);

    const metadataRaw = await readFile(
      metadataCacheFilePath(root, Path.posix(mediaDir)),
      "utf-8",
    );
    const metadata = JSON.parse(metadataRaw) as MediaMetadata;
    expect(metadata.files).toEqual([Path.posix(toFile)]);
    expect(metadata.mediaFiles?.[0]?.absolutePath).toBe(Path.posix(toFile));
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "mediaMetadataUpdated",
        data: { folderPath: Path.posix(mediaDir) },
      }),
    );
  });

  it("returns validation error when target file already exists", async () => {
    const existing = join(mediaDir, "exists.mkv");
    const target = join(mediaDir, "also-exists.mkv");
    await writeFile(existing, "a");
    await writeFile(target, "b");

    const result = await doRenameFiles(
      {
        files: [{ from: existing, to: target }],
        mediaFolder: Path.posix(mediaDir),
      },
      config,
    );

    expect(result.error).toContain("already exists");
  });
});

describe("handleRenameFilesPost route", () => {
  it("returns 404 for unknown path", async () => {
    const { handleCoreRoutesRequest } = await import("./register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/unknown";

    let statusCode = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      statusCode = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: string) => {
      body = chunk ?? "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist: [] }, 18081);
    socket.destroy();

    expect(statusCode).toBe(404);
    expect(body).toContain("Not found");
  });

  it("returns 200 instead of 404 for a valid request body", async () => {
    const { handleCoreRoutesRequest } = await import("./register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/renameFiles";
    req.headers = { "content-type": "application/json" };
    req.push(Buffer.from(JSON.stringify({ files: [{ from: "/tmp/a.mkv", to: "/tmp/b.mkv" }] })));
    req.push(null);

    let statusCode = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      statusCode = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: string) => {
      body = chunk ?? "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist: [] }, 18081);
    socket.destroy();

    const parsed = JSON.parse(body) as { error?: string };
    expect(statusCode).toBe(200);
    expect(parsed.error).toBeTruthy();
  });
});
