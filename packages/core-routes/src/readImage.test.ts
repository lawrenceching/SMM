import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { doReadImage } from "./readImage.ts";

const silentLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function toPosix(p: string): string {
  if (sep === "/") return p;
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
}

/**
 * Compute the base64 string of `data` without depending on the
 * runtime's `Buffer` to keep the assertion order stable.
 */
function base64Of(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  // btoa is available in Node 16+ globally.
  return btoa(binary);
}

describe("doReadImage", () => {
  let tempDir: string;
  let posixDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "smm-read-image-"));
    posixDir = toPosix(tempDir);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    silentLogger.debug.mockClear();
    silentLogger.info.mockClear();
    silentLogger.warn.mockClear();
    silentLogger.error.mockClear();
  });

  it("returns a base64 data URL for an allowlisted PNG", async () => {
    const filePath = join(tempDir, "image.png");
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await writeFile(filePath, bytes);

    const result = await doReadImage(
      { path: filePath },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toBeUndefined();
    expect(result.data).toBe(
      `data:image/png;base64,${base64Of(bytes)}`,
    );
  });

  it("returns a base64 data URL for a JPG", async () => {
    const filePath = join(tempDir, "photo.jpg");
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    await writeFile(filePath, bytes);

    const result = await doReadImage(
      { path: filePath },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.data).toBe(`data:image/jpeg;base64,${base64Of(bytes)}`);
  });

  it("returns File Not Found for a missing path", async () => {
    const result = await doReadImage(
      { path: join(tempDir, "does-not-exist.png") },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/File Not Found/);
  });

  it("rejects paths outside the allowlist", async () => {
    const result = await doReadImage(
      { path: "/etc/passwd.png" },
      { allowlist: [posixDir], logger: silentLogger },
    );
    expect(result.error).toContain("not in the allowlist");
  });

  it("rejects non-image extensions", async () => {
    const filePath = join(tempDir, "notes.txt");
    await writeFile(filePath, "hello world", "utf-8");

    const result = await doReadImage(
      { path: filePath },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("not a valid image file");
  });

  it("rejects empty path with Validation failed", async () => {
    const result = await doReadImage(
      { path: "" },
      { allowlist: [posixDir], logger: silentLogger },
    );
    expect(result.error).toMatch(/Validation failed/);
  });

  it.each([
    [".gif", "image/gif"],
    [".webp", "image/webp"],
    [".svg", "image/svg+xml"],
    [".bmp", "image/bmp"],
    [".ico", "image/x-icon"],
    [".tiff", "image/tiff"],
    [".tif", "image/tiff"],
  ])("encodes %s as %s data URL", async (ext, mime) => {
    const filePath = join(tempDir, `sample${ext}`);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await writeFile(filePath, bytes);

    const result = await doReadImage(
      { path: filePath },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toBeUndefined();
    expect(result.data).toBe(`data:${mime};base64,${base64Of(bytes)}`);
  });
});