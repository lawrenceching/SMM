import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { doDeleteFolder } from "./deleteFolder.ts";

/**
 * Convert a platform-native path to POSIX format (mirrors `Path.posix`).
 * On Windows, "C:\\Users\\x" -> "/C/Users/x". On POSIX, leaves it alone.
 */
function toPosix(p: string): string {
  if (sep === "/") return p;
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
}

function posixDirOf(p: string): string {
  const posix = toPosix(p);
  return posix.slice(0, posix.lastIndexOf("/"));
}

const silentLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("doDeleteFolder", () => {
  let dir: string;
  let posixDir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "smm-do-delete-folder-"));
    posixDir = toPosix(dir);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    silentLogger.debug.mockClear();
    silentLogger.info.mockClear();
    silentLogger.warn.mockClear();
    silentLogger.error.mockClear();
  });

  it("deletes an existing directory in the allowlist", async () => {
    const target = join(dir, "victim-dir");
    await mkdir(target);
    await writeFile(join(target, "nested.txt"), "x", "utf-8");

    const result = await doDeleteFolder(
      { path: target },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toBeUndefined();
    expect(result.data?.path).toBeTruthy();

    const { stat } = await import("node:fs/promises");
    await expect(stat(target)).rejects.toThrow();
  });

  it("treats ENOENT during stat as idempotent success", async () => {
    const target = join(dir, "never-existed-dir");

    const result = await doDeleteFolder(
      { path: target },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toBeUndefined();
    expect(result.data?.path).toBeTruthy();
    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ folderPath: expect.any(String) }),
      "doDeleteFolder: folder already absent",
    );
  });

  it("rejects paths outside the allowlist", async () => {
    const result = await doDeleteFolder(
      { path: "/etc/passwd" },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("not in the allowlist");
    expect(silentLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        folderPath: expect.stringContaining("etc/passwd"),
      }),
      "doDeleteFolder: path not in allowlist",
    );
  });

  it("returns Validation Failed error for empty path", async () => {
    const result = await doDeleteFolder(
      { path: "" },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("Validation Failed");
    expect(result.error).toContain("Path is required");
  });

  it("returns Validation Failed error for missing path field", async () => {
    const result = await doDeleteFolder(
      {} as unknown as { path: string },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("Validation Failed");
    expect(result.error).toMatch(/Required|Path is required/);
  });

  it("returns Path Is File error when target is a file", async () => {
    const filePath = join(dir, "a-file.txt");
    await writeFile(filePath, "x", "utf-8");

    const result = await doDeleteFolder(
      { path: filePath },
      { allowlist: [posixDirOf(filePath)], logger: silentLogger },
    );

    expect(result.error).toContain("Path Is File");
    expect(result.error).toContain(filePath);
  });
});
