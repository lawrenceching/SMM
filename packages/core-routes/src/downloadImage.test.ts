import { Buffer } from "node:buffer";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { describeFetchError, doDownloadImage } from "./downloadImage.ts";

const silentLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

/**
 * Convert a platform-native path to POSIX format (mirrors `Path.posix`).
 * On Windows, "C:\\Users\\x" -> "/C/Users/x". On POSIX, leaves it alone.
 */
function toPosix(p: string): string {
  if (sep === "/") return p;
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
}

function makeResponse(opts: {
  status?: number;
  contentType?: string | null;
  body?: ArrayBuffer;
}): Response {
  const headers = new Map<string, string>();
  if (opts.contentType !== null && opts.contentType !== undefined) {
    headers.set("content-type", opts.contentType);
  }
  return {
    ok: opts.status === undefined ? true : opts.status >= 200 && opts.status < 300,
    status: opts.status ?? 200,
    headers: {
      get(name: string): string | null {
        return headers.get(name.toLowerCase()) ?? null;
      },
    },
    arrayBuffer: () =>
      Promise.resolve(opts.body ?? new ArrayBuffer(0)),
  } as unknown as Response;
}

describe("doDownloadImage", () => {
  let tempDir: string;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "smm-download-image-"));
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

  describe("URL normalization", () => {
    it("uses fetchImpl when provided instead of global fetch", async () => {
      const customFetch = vi.fn().mockResolvedValue(
        makeResponse({ contentType: "image/jpeg", body: new ArrayBuffer(10) }),
      );
      await doDownloadImage("https://example.com/image.jpg", {
        allowlist: [],
        logger: silentLogger,
        fetchImpl: customFetch,
      });
      expect(customFetch).toHaveBeenCalledWith(
        "https://example.com/image.jpg",
        expect.objectContaining({ method: "GET" }),
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("normalizes protocol-relative URLs (//host/path) to https://", async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ contentType: "image/jpeg", body: new ArrayBuffer(10) }),
      );
      const result = await doDownloadImage("//example.com/image.jpg", {
        allowlist: [],
        logger: silentLogger,
      });
      expect(result.contentType).toBe("image/jpeg");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/image.jpg",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("passes through http:// URLs", async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ contentType: "image/jpeg", body: new ArrayBuffer(10) }),
      );
      const result = await doDownloadImage("http://example.com/image.jpg", {
        allowlist: [],
        logger: silentLogger,
      });
      expect(result.contentType).toBe("image/jpeg");
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://example.com/image.jpg",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("passes through https:// URLs", async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ contentType: "image/png", body: new ArrayBuffer(20) }),
      );
      const result = await doDownloadImage("https://example.com/image.png", {
        allowlist: [],
        logger: silentLogger,
      });
      expect(result.contentType).toBe("image/png");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/image.png",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("HTTP response handling", () => {
    it("uses the response content-type when present", async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({
          contentType: "image/webp",
          body: new ArrayBuffer(50),
        }),
      );
      const result = await doDownloadImage("https://example.com/x.webp", {
        allowlist: [],
        logger: silentLogger,
      });
      expect(result.contentType).toBe("image/webp");
      expect(result.buffer.length).toBe(50);
    });

    it("defaults to image/jpeg when content-type is missing", async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ contentType: null, body: new ArrayBuffer(5) }),
      );
      const result = await doDownloadImage("https://example.com/x", {
        allowlist: [],
        logger: silentLogger,
      });
      expect(result.contentType).toBe("image/jpeg");
    });

    it("throws on non-2xx with the status code in the message", async () => {
      fetchSpy.mockResolvedValue(makeResponse({ status: 404 }));
      await expect(
        doDownloadImage("https://example.com/nope.jpg", {
          allowlist: [],
          logger: silentLogger,
        }),
      ).rejects.toThrow(
        "HTTP error! status: 404",
      );
    });

    it("throws on HTTP 500", async () => {
      fetchSpy.mockResolvedValue(makeResponse({ status: 500 }));
      await expect(
        doDownloadImage("https://example.com/x", {
          allowlist: [],
          logger: silentLogger,
        }),
      ).rejects.toThrow(
        "HTTP error! status: 500",
      );
    });

    it("propagates network errors", async () => {
      fetchSpy.mockRejectedValue(new Error("Network down"));
      await expect(
        doDownloadImage("https://example.com/x", {
          allowlist: [],
          logger: silentLogger,
        }),
      ).rejects.toThrow(
        "Network down",
      );
    });

    it("surfaces fetch-failed with its cause code in the thrown error", async () => {
      const cause = Object.assign(new Error("getaddrinfo ENOTFOUND x"), {
        code: "ENOTFOUND",
      });
      fetchSpy.mockRejectedValue(
        Object.assign(new TypeError("fetch failed"), { cause }),
      );
      await expect(
        doDownloadImage("https://example.com/x", {
          allowlist: [],
          logger: silentLogger,
        }),
      ).rejects.toThrow(
        "Failed to download image: fetch failed (ENOTFOUND: getaddrinfo ENOTFOUND x)",
      );
    });

    it("uses the original browser-like headers", async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ contentType: "image/jpeg", body: new ArrayBuffer(1) }),
      );
      await doDownloadImage("https://example.com/x.jpg", {
        allowlist: [],
        logger: silentLogger,
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/x.jpg",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            accept: expect.stringContaining("image/avif"),
            "user-agent": expect.stringContaining("Mozilla"),
            "sec-fetch-dest": "image",
          }),
        }),
      );
    });
  });

  describe("file:// URL handling", () => {
    it("reads an allowlisted file and infers content-type from extension", async () => {
      const filePath = join(tempDir, "local.png");
      await writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const posix = toPosix(filePath);
      const result = await doDownloadImage(`file://${filePath}`, {
        allowlist: [posix.slice(0, posix.lastIndexOf("/"))],
        logger: silentLogger,
      });
      expect(result.contentType).toBe("image/png");
      expect(result.buffer.length).toBe(4);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects file:// URLs that are not in the allowlist", async () => {
      const filePath = join(tempDir, "secret.jpg");
      await writeFile(filePath, "secret");
      await expect(
        doDownloadImage(`file://${filePath}`, {
          allowlist: ["/nowhere"],
          logger: silentLogger,
        }),
      ).rejects.toThrow(/not allowed to be read/);
    });
  });

  describe("invalid URLs", () => {
    it("rejects ftp:// URLs", async () => {
      await expect(
        doDownloadImage("ftp://example.com/x", {
          allowlist: [],
          logger: silentLogger,
        }),
      ).rejects.toThrow(
        "Invalid image URL",
      );
    });

    it("rejects data: URLs", async () => {
      await expect(
        doDownloadImage("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD", {
          allowlist: [],
          logger: silentLogger,
        }),
      ).rejects.toThrow("Invalid image URL");
    });

    it("rejects empty string URL", async () => {
      await expect(
        doDownloadImage("", {
          allowlist: [],
          logger: silentLogger,
        }),
      ).rejects.toThrow("Invalid image URL");
    });
  });

  describe("edge cases", () => {
    it("preserves URL query parameters when fetching", async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ contentType: "image/jpeg", body: new ArrayBuffer(10) }),
      );
      await doDownloadImage("https://example.com/x.jpg?w=200&h=200", {
        allowlist: [],
        logger: silentLogger,
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/x.jpg?w=200&h=200",
        expect.any(Object),
      );
    });

    it("preserves URL fragments when fetching", async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ contentType: "image/jpeg", body: new ArrayBuffer(10) }),
      );
      await doDownloadImage("https://example.com/x.jpg#section", {
        allowlist: [],
        logger: silentLogger,
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/x.jpg#section",
        expect.any(Object),
      );
    });
  });
});

describe("describeFetchError", () => {
  it("surfaces a fetch-failed error with its cause code and message", () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND example.com"), {
      code: "ENOTFOUND",
    });
    const error = Object.assign(new TypeError("fetch failed"), { cause });
    expect(describeFetchError(error)).toBe(
      "fetch failed (ENOTFOUND: getaddrinfo ENOTFOUND example.com)",
    );
  });

  it("includes the cause code when there is no separate cause message", () => {
    const cause = Object.assign(new Error("Connect Timeout"), {
      code: "ETIMEDOUT",
    });
    const error = Object.assign(new TypeError("fetch failed"), { cause });
    expect(describeFetchError(error)).toBe(
      "fetch failed (ETIMEDOUT: Connect Timeout)",
    );
  });

  it("includes only the cause message when no code is attached", () => {
    const cause = new Error("UND_ERR_CONNECT_TIMEOUT");
    const error = Object.assign(new TypeError("fetch failed"), { cause });
    expect(describeFetchError(error)).toBe(
      "fetch failed (UND_ERR_CONNECT_TIMEOUT)",
    );
  });

  it("falls back to the original message when no cause is attached", () => {
    expect(describeFetchError(new TypeError("fetch failed"))).toBe(
      "fetch failed",
    );
  });

  it("handles non-Error inputs", () => {
    expect(describeFetchError("boom")).toBe("boom");
    expect(describeFetchError(undefined)).toBe("undefined");
  });

  it("propagates the message from a wrapped ECONNREFUSED cause", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });
    const error = Object.assign(new TypeError("fetch failed"), { cause });
    expect(describeFetchError(error)).toContain("ECONNREFUSED");
    expect(describeFetchError(error)).toContain("ECONNREFUSED");
  });

  it("handles Bun-style errors that flatten the cause onto the error", () => {
    // Bun attaches `code`/`errno` directly to the fetch error
    // (no `.cause` wrapper).
    const error = Object.assign(
      new Error("Unable to connect. Is the computer able to access the url?"),
      { code: "ConnectionRefused" },
    );
    expect(describeFetchError(error)).toBe(
      "Unable to connect. Is the computer able to access the url? (ConnectionRefused)",
    );
  });

  it("falls back to the errno when the code is not present (Bun)", () => {
    const error = Object.assign(new Error("Was there a typo?"), {
      errno: "FailedToOpenSocket",
    });
    expect(describeFetchError(error)).toBe(
      "Was there a typo? (FailedToOpenSocket)",
    );
  });
});