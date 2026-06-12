import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { doDeleteFile } from "./deleteFile.ts";

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

describe("doDeleteFile", () => {
  let dir: string;
  let filePath: string;
  let posixDir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "smm-do-delete-file-"));
    filePath = join(dir, "delete-me.txt");
    await writeFile(filePath, "goodbye", "utf-8");
    posixDir = posixDirOf(filePath);
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

  it("deletes an existing file in the allowlist", async () => {
    const target = join(dir, "victim.txt");
    await writeFile(target, "x", "utf-8");

    const result = await doDeleteFile(
      { path: target },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toBeUndefined();
    expect(result.data?.path).toBeTruthy();

    const { stat } = await import("node:fs/promises");
    await expect(stat(target)).rejects.toThrow();
  });

  it("treats ENOENT during stat as idempotent success", async () => {
    const target = join(dir, "never-existed.txt");

    const result = await doDeleteFile(
      { path: target },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toBeUndefined();
    expect(result.data?.path).toBeTruthy();
    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: expect.any(String) }),
      "doDeleteFile: file already absent",
    );
  });

  it("rejects paths outside the allowlist", async () => {
    const result = await doDeleteFile(
      { path: "/etc/passwd" },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("not in the allowlist");
    // path.resolve on Windows turns "/etc/passwd" into a C:\-rooted path
    // (Path.posix then reformats it back), so we just verify that the
    // warning was emitted with some resolved form of /etc/passwd.
    expect(silentLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: expect.stringContaining("etc/passwd"),
      }),
      "doDeleteFile: path not in allowlist",
    );
  });

  it("returns Validation Failed error for empty path", async () => {
    const result = await doDeleteFile(
      { path: "" },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("Validation Failed");
    expect(result.error).toContain("Path is required");
  });

  it("returns Validation Failed error for missing path field", async () => {
    const result = await doDeleteFile(
      {} as unknown as { path: string },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("Validation Failed");
    // zod reports "Required" for a missing field, not "Path is required"
    // (which only fires when the field is present but empty).
    expect(result.error).toMatch(/Required|Path is required/);
  });

  it("returns Validation Failed error for null path field", async () => {
    const result = await doDeleteFile(
      { path: null as unknown as string },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("Validation Failed");
  });

  it("returns Path Is Directory error when target is a directory", async () => {
    const subdir = join(dir, "a-directory");
    await mkdir(subdir);

    const result = await doDeleteFile(
      { path: subdir },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("Path Is Directory");
    expect(result.error).toContain(subdir);
  });

  it("returns Unexpected Error when path resolution throws", async () => {
    // We cannot spyOn node:path in ESM, so we exercise the outer
    // try/catch by mocking `path.resolve` via vi.doMock.
    vi.doMock("node:path", async () => {
      const actual = await vi.importActual<typeof import("node:path")>("node:path");
      return {
        ...actual,
        default: {
          ...actual,
          resolve: vi.fn(() => {
            throw new Error("path.resolve exploded");
          }),
        },
        resolve: vi.fn(() => {
          throw new Error("path.resolve exploded");
        }),
      };
    });

    vi.resetModules();
    const { doDeleteFile: mockedDoDeleteFile } = await import("./deleteFile.ts");

    const result = await mockedDoDeleteFile(
      { path: "/anything" },
      { allowlist: ["/"], logger: silentLogger },
    );

    expect(result.error).toContain("Unexpected Error");
    expect(result.error).toContain("path.resolve exploded");

    vi.doUnmock("node:path");
    vi.resetModules();
  });
});

describe("doDeleteFile (mocked fs)", () => {
  let mockedDir: string;
  let mockedFilePath: string;
  let mockedPosixDir: string;

  beforeAll(async () => {
    mockedDir = await mkdtemp(join(tmpdir(), "smm-delete-file-mocked-"));
    mockedFilePath = join(mockedDir, "mocked.txt");
    mockedPosixDir = posixDirOf(mockedFilePath);
  });

  afterAll(async () => {
    await rm(mockedDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    silentLogger.debug.mockClear();
    silentLogger.info.mockClear();
    silentLogger.warn.mockClear();
    silentLogger.error.mockClear();
  });

  it("returns Permission denied on EACCES during unlink", async () => {
    vi.doMock("node:fs/promises", async () => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises",
      );
      return {
        ...actual,
        stat: vi.fn(async () => ({ isFile: () => true })),
        unlink: vi.fn(async () => {
          const err = new Error("permission denied") as NodeJS.ErrnoException;
          err.code = "EACCES";
          throw err;
        }),
      };
    });

    vi.resetModules();
    const { doDeleteFile: mockedDoDeleteFile } = await import("./deleteFile.ts");

    const result = await mockedDoDeleteFile(
      { path: mockedFilePath },
      { allowlist: [mockedPosixDir], logger: silentLogger },
    );

    expect(result.error).toContain("Permission denied");
    expect(result.error).toContain(mockedFilePath);

    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });

  it("returns Failed to delete file error on generic unlink failure", async () => {
    vi.doMock("node:fs/promises", async () => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises",
      );
      return {
        ...actual,
        stat: vi.fn(async () => ({ isFile: () => true })),
        unlink: vi.fn(async () => {
          const err = new Error("disk on fire") as NodeJS.ErrnoException;
          err.code = "EIO";
          throw err;
        }),
      };
    });

    vi.resetModules();
    const { doDeleteFile: mockedDoDeleteFile } = await import("./deleteFile.ts");

    const result = await mockedDoDeleteFile(
      { path: mockedFilePath },
      { allowlist: [mockedPosixDir], logger: silentLogger },
    );

    expect(result.error).toContain("Failed to delete file");
    expect(result.error).toContain("disk on fire");

    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });

  it("treats ENOENT during unlink as idempotent success", async () => {
    vi.doMock("node:fs/promises", async () => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises",
      );
      return {
        ...actual,
        stat: vi.fn(async () => ({ isFile: () => true })),
        unlink: vi.fn(async () => {
          const err = new Error("no such file") as NodeJS.ErrnoException;
          err.code = "ENOENT";
          throw err;
        }),
      };
    });

    vi.resetModules();
    const { doDeleteFile: mockedDoDeleteFile } = await import("./deleteFile.ts");

    const result = await mockedDoDeleteFile(
      { path: mockedFilePath },
      { allowlist: [mockedPosixDir], logger: silentLogger },
    );

    expect(result.error).toBeUndefined();
    expect(result.data?.path).toBeTruthy();

    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });

  it("returns Cannot access file error on non-ENOENT stat failure", async () => {
    vi.doMock("node:fs/promises", async () => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises",
      );
      return {
        ...actual,
        stat: vi.fn(async () => {
          const err = new Error("i/o error") as NodeJS.ErrnoException;
          err.code = "EIO";
          throw err;
        }),
        unlink: vi.fn(),
      };
    });

    vi.resetModules();
    const { doDeleteFile: mockedDoDeleteFile } = await import("./deleteFile.ts");

    const result = await mockedDoDeleteFile(
      { path: mockedFilePath },
      { allowlist: [mockedPosixDir], logger: silentLogger },
    );

    expect(result.error).toContain("Cannot access file");
    expect(result.error).toContain("i/o error");

    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });
});