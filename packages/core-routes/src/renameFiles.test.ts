import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Path } from "@smm/utils/path";
import type { MediaMetadata } from "@smm/types";
import { metadataCacheFilePath } from "./mediaMetadataCache.ts";
import { doRenameFiles } from "./renameFiles.ts";
import type { CoreRoutesConfig } from "./types.ts";

function toAllowlistPrefix(platformPath: string): string {
  return platformPath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
}

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
    await writeFile(fromFile, "video");

    const metadata: MediaMetadata = {
      mediaFolderPath: Path.posix(mediaDir),
      type: "tvshow-folder",
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
      allowlist: [toAllowlistPrefix(root)],
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

  it("rejects when mediaFolder is omitted and strict defaults to true", async () => {
    const fromFile = join(mediaDir, "strict-default.mkv");
    const toFile = join(mediaDir, "strict-default-renamed.mkv");
    await writeFile(fromFile, "video");

    const result = await doRenameFiles(
      {
        files: [{ from: fromFile, to: toFile }],
      },
      config,
    );

    expect(result.error).toContain("mediaFolder is required when strict is true");
  });

  it("rejects when mediaFolder is omitted and strict is true", async () => {
    const fromFile = join(mediaDir, "strict-true.mkv");
    const toFile = join(mediaDir, "strict-true-renamed.mkv");
    await writeFile(fromFile, "video");

    const result = await doRenameFiles(
      {
        files: [{ from: fromFile, to: toFile }],
        strict: true,
      },
      config,
    );

    expect(result.error).toContain("mediaFolder is required when strict is true");
  });

  it("resolves mediaFolder from smm.json when strict is false", async () => {
    const fromFile = join(mediaDir, "strict-false.mkv");
    const toFile = join(mediaDir, "strict-false-renamed.mkv");
    await writeFile(fromFile, "video");

    const result = await doRenameFiles(
      {
        files: [{ from: fromFile, to: toFile }],
        strict: false,
      },
      config,
    );

    expect(result.error).toBeUndefined();
    expect(result.data?.succeeded).toEqual([Path.posix(fromFile)]);
  });

  it("rejects paths outside the allowlist", async () => {
    const outsideRoot = await mkdtemp(join(tmpdir(), "smm-rename-outside-"));
    try {
      const fromFile = join(outsideRoot, "out.mkv");
      const toFile = join(outsideRoot, "out-renamed.mkv");
      await writeFile(fromFile, "video");

      const result = await doRenameFiles(
        {
          files: [{ from: fromFile, to: toFile }],
          mediaFolder: Path.posix(outsideRoot),
        },
        config,
      );

      expect(result.error).toContain("is not in the allowlist");
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });
});

describe("doRenameFiles Linux-like userDataDir vs appDataDir", () => {
  it("reads smm.json from hello.userDataDir when appDataDir differs (strict: false)", async () => {
    const root = await mkdtemp(join(tmpdir(), "smm-rename-split-"));
    const userDataDir = join(root, "config", "smm");
    const appDataDir = join(root, "share", "smm");
    const mediaDir = join(root, "media", "show");
    const fromFile = join(mediaDir, "S01E01.mp4");
    const toFile = join(mediaDir, "S01E01_renamed.mp4");

    await mkdir(userDataDir, { recursive: true });
    await mkdir(join(appDataDir, "metadata"), { recursive: true });
    await mkdir(mediaDir, { recursive: true });
    await writeFile(fromFile, "video");
    await writeFile(
      join(userDataDir, "smm.json"),
      JSON.stringify({ folders: [mediaDir] }),
      "utf-8",
    );

    const allowlist = [toAllowlistPrefix(root)];

    // Bug reproduction: only appDataDir → cannot find folders in smm.json
    const brokenConfig: CoreRoutesConfig = {
      allowlist,
      appDataDir,
    };
    const broken = await doRenameFiles(
      {
        files: [{ from: fromFile, to: toFile }],
        strict: false,
      },
      brokenConfig,
    );
    expect(broken.error).toContain("Media folder not found");

    // Fix: hello.userDataDir points at the config that holds folders
    const fixedConfig: CoreRoutesConfig = {
      allowlist,
      appDataDir,
      hello: { userDataDir, appDataDir } as CoreRoutesConfig["hello"],
    };
    const fixed = await doRenameFiles(
      {
        files: [{ from: fromFile, to: toFile }],
        strict: false,
      },
      fixedConfig,
    );
    expect(fixed.error).toBeUndefined();
    expect(fixed.data?.succeeded).toEqual([Path.posix(fromFile)]);

    await rm(root, { recursive: true, force: true });
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

  it("returns 200 with mediaFolder required error when body omits mediaFolder", async () => {
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
    expect(parsed.error).toContain("mediaFolder is required when strict is true");
  });
});
