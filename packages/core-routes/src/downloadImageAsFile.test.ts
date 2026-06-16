import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { doDownloadImageAsFile } from "./downloadImageAsFile.ts";

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

function makeResponse(opts: {
  status?: number;
  body?: ArrayBuffer;
}): Response {
  return {
    ok: opts.status === undefined ? true : opts.status >= 200 && opts.status < 300,
    status: opts.status ?? 200,
    headers: {
      get: () => null,
    },
    arrayBuffer: () => Promise.resolve(opts.body ?? new ArrayBuffer(0)),
  } as unknown as Response;
}

describe("doDownloadImageAsFile", () => {
  let tempDir: string;
  let posixDir: string;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "smm-download-image-as-file-"));
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
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("uses fetchImpl when provided instead of global fetch", async () => {
    const dest = join(tempDir, "fetch-impl.jpg");
    const customFetch = vi.fn().mockResolvedValue(
      makeResponse({ body: new TextEncoder().encode("custom-fetch").buffer }),
    );

    const result = await doDownloadImageAsFile(
      { url: "https://example.com/x.jpg", path: dest },
      { allowlist: [posixDir], logger: silentLogger, fetchImpl: customFetch },
    );

    expect(result.error).toBeUndefined();
    expect(customFetch).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await readFile(dest, "utf-8")).toBe("custom-fetch");
  });

  it("writes the file when the destination does not exist", async () => {
    const dest = join(tempDir, "new.jpg");
    fetchSpy.mockResolvedValue(
      makeResponse({ body: new TextEncoder().encode("hello-bytes").buffer }),
    );

    const result = await doDownloadImageAsFile(
      { url: "https://example.com/x.jpg", path: dest },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toBeUndefined();
    expect(result.data?.url).toBe("https://example.com/x.jpg");
    expect(result.data?.path).toBe(dest);
    const written = await readFile(dest, "utf-8");
    expect(written).toBe("hello-bytes");
  });

  it("returns an existedFileError when the destination already exists", async () => {
    const dest = join(tempDir, "existing.jpg");
    await writeFile(dest, "already-here", "utf-8");

    const result = await doDownloadImageAsFile(
      { url: "https://example.com/x.jpg", path: dest },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toMatch(/File Already Existed/);
    expect(result.error).toContain(dest);
    expect(result.data?.url).toBe("https://example.com/x.jpg");
    expect(result.data?.path).toBe(dest);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects paths outside the allowlist", async () => {
    const result = await doDownloadImageAsFile(
      { url: "https://example.com/x.jpg", path: "/etc/passwd.jpg" },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("not in the allowlist");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("normalizes protocol-relative URLs to https", async () => {
    const dest = join(tempDir, "rel.jpg");
    fetchSpy.mockResolvedValue(
      makeResponse({ body: new ArrayBuffer(4) }),
    );

    await doDownloadImageAsFile(
      { url: "//example.com/x.jpg", path: dest },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/x.jpg",
      expect.any(Object),
    );
  });

  it("rejects non-http(s) URLs without performing a fetch", async () => {
    const dest = join(tempDir, "ftp.jpg");
    const result = await doDownloadImageAsFile(
      { url: "ftp://example.com/x.jpg", path: dest },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("Invalid image URL");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns HTTP error! status: <n> for non-2xx responses", async () => {
    const dest = join(tempDir, "missing.jpg");
    fetchSpy.mockResolvedValue(makeResponse({ status: 404 }));

    const result = await doDownloadImageAsFile(
      { url: "https://example.com/nope.jpg", path: dest },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toContain("HTTP error! status: 404");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns Validation failed for missing url", async () => {
    const result = await doDownloadImageAsFile(
      { url: "", path: join(tempDir, "x.jpg") },
      { allowlist: [posixDir], logger: silentLogger },
    );
    expect(result.error).toMatch(/Validation failed/);
  });

  it("returns Validation failed for missing path", async () => {
    const result = await doDownloadImageAsFile(
      { url: "https://example.com/x.jpg", path: "" },
      { allowlist: [posixDir], logger: silentLogger },
    );
    expect(result.error).toMatch(/Validation failed/);
  });

  it("writes binary content correctly", async () => {
    const dest = join(tempDir, "binary.bin");
    const payload = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
    fetchSpy.mockResolvedValue(
      makeResponse({
        body: payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
      }),
    );

    await doDownloadImageAsFile(
      { url: "https://example.com/x.bin", path: dest },
      { allowlist: [posixDir], logger: silentLogger },
    );

    const written = await readFile(dest);
    expect(Array.from(written)).toEqual(Array.from(payload));
  });

  it("sends browser-like headers on fetch", async () => {
    const dest = join(tempDir, "headers.jpg");
    fetchSpy.mockResolvedValue(makeResponse({ body: new ArrayBuffer(1) }));

    await doDownloadImageAsFile(
      { url: "https://example.com/x.jpg", path: dest },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/x.jpg",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("Mozilla"),
          accept: expect.stringContaining("image/avif"),
          "sec-fetch-dest": "image",
        }),
      }),
    );
  });

  it("surfaces fetch-failed with its cause code in the response error", async () => {
    const dest = join(tempDir, "neterr.jpg");
    const cause = Object.assign(new Error("connect ETIMEDOUT"), {
      code: "ETIMEDOUT",
    });
    fetchSpy.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), { cause }),
    );

    const result = await doDownloadImageAsFile(
      { url: "https://example.com/x.jpg", path: dest },
      { allowlist: [posixDir], logger: silentLogger },
    );

    expect(result.error).toBe(
      "Image URL fetch failed: fetch failed (ETIMEDOUT: connect ETIMEDOUT)",
    );
  });
});