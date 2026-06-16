import { mkdtemp, mkdir, writeFile, rm, stat, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { validatePathIsInAllowlist } from "../src/allowlist.ts";

describe("validatePathIsInAllowlist", () => {
  it("returns true when path is under an allowlist entry", () => {
    const allowlist = ["/home/user/data", "/tmp/smm"];
    expect(validatePathIsInAllowlist("/home/user/data/file.txt", allowlist)).toBe(true);
    expect(validatePathIsInAllowlist("/tmp/smm/cache.json", allowlist)).toBe(true);
  });

  it("returns false when path is outside allowlist", () => {
    const allowlist = ["/home/user/data"];
    expect(validatePathIsInAllowlist("/etc/passwd", allowlist)).toBe(false);
    expect(validatePathIsInAllowlist("/home/other/file.txt", allowlist)).toBe(false);
  });
});

describe("doListFiles", () => {
  it("lists files in a directory", async () => {
    const { doListFiles } = await import("../src/listFiles.ts");
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-list-"));
    await writeFile(path.join(dir, "a.txt"), "hello");
    await mkdir(path.join(dir, "sub"));

    const result = await doListFiles({ path: dir, onlyFiles: true });

    expect(result.error).toBeUndefined();
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0]?.path).toBe(path.join(dir, "a.txt"));

    await rm(dir, { recursive: true, force: true });
  });
});

describe("doWriteFile", () => {
  it("creates a file when path is in allowlist", async () => {
    const { doWriteFile } = await import("../src/writeFile.ts");
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-write-"));
    const filePath = path.join(dir, "new.txt");
    const posixDir = filePath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");

    const result = await doWriteFile(
      { path: filePath, mode: "create", data: "content" },
      { allowlist: [posixDir.slice(0, posixDir.lastIndexOf("/"))] },
    );

    expect(result.error).toBeUndefined();
    const { readFile } = await import("node:fs/promises");
    expect(await readFile(filePath, "utf-8")).toBe("content");

    await rm(dir, { recursive: true, force: true });
  });

  it("rejects paths outside allowlist", async () => {
    const { doWriteFile } = await import("../src/writeFile.ts");
    const result = await doWriteFile(
      { path: "/tmp/outside.txt", mode: "create", data: "x" },
      { allowlist: ["/allowed-only"] },
    );

    expect(result.error).toContain("not in allowlist");
  });
});

describe("handleCoreRoutesRequest", () => {
  async function requestCoreRoute(
    method: string,
    url: string,
    config: { allowlist: string[]; hello?: import("../src/hello.ts").HelloOptions },
    rawBody?: string,
  ) {
    const { handleCoreRoutesRequest } = await import("../src/register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = { "content-type": "application/json" };

    if (rawBody !== undefined) {
      req.push(Buffer.from(rawBody));
      req.push(null);
    }

    let status = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, config, 3001);

    socket.destroy();
    return { status, body: body ? (JSON.parse(body) as Record<string, unknown>) : {} };
  }

  it("returns 404 for unknown routes", async () => {
    const { status, body } = await requestCoreRoute("GET", "/api/unknown", { allowlist: [] });
    expect(status).toBe(404);
    expect(body.error).toContain("Not found");
  });

  it("returns HelloResponseBody when config.hello is provided", async () => {
    const { status, body } = await requestCoreRoute("POST", "/api/hello", {
      allowlist: [],
      hello: {
        version: "1.3.8",
        userDataDir: "/tmp/userData",
        appDataDir: "/tmp/appData",
        logDir: "/tmp/logs",
        tmpDir: "/tmp",
        reverseProxyUrl: null,
        osLocale: "en-US",
        coreRoutesPort: 3001,
      },
    });

    expect(status).toBe(200);
    expect(body.version).toBe("1.3.8");
    expect(body.userDataDir).toBe("/tmp/userData");
    expect(typeof body.uptime).toBe("number");
  });

  it('returns { error: "hello not configured" } when config.hello is undefined', async () => {
    const { status, body } = await requestCoreRoute("POST", "/api/hello", { allowlist: [] });

    expect(status).toBe(200);
    expect(body.error).toBe("hello not configured");
  });
});

describe("POST /api/isFolderAvailable", () => {
  async function requestIsFolderAvailable(rawBody: string | undefined) {
    const { handleCoreRoutesRequest } = await import("../src/register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/isFolderAvailable";
    req.headers = { "content-type": "application/json" };

    if (rawBody !== undefined) {
      req.push(Buffer.from(rawBody));
      req.push(null);
    }

    let status = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist: [] }, 3001);

    socket.destroy();
    return { status, body: body ? (JSON.parse(body) as Record<string, unknown>) : {} };
  }

  it("returns 200 with available true for an existing directory", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-ifa-"));
    try {
      const { status, body } = await requestIsFolderAvailable(JSON.stringify({ path: dir }));
      expect(status).toBe(200);
      expect(body.available).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns 200 with available false for a missing path", async () => {
    const missingPath = path.join(os.tmpdir(), `smm-missing-${Date.now()}`);
    const { status, body } = await requestIsFolderAvailable(
      JSON.stringify({ path: missingPath }),
    );
    expect(status).toBe(200);
    expect(body.available).toBe(false);
  });

  it("returns 400 for invalid JSON", async () => {
    const { status, body } = await requestIsFolderAvailable("not-json");
    expect(status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 for missing path", async () => {
    const { status, body } = await requestIsFolderAvailable(JSON.stringify({}));
    expect(status).toBe(400);
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 for empty path", async () => {
    const { status, body } = await requestIsFolderAvailable(JSON.stringify({ path: "" }));
    expect(status).toBe(400);
    expect(body.error).toBe("Validation failed");
  });
});

describe("POST /api/readFile", () => {
  function toPosix(p: string): string {
    if (path.sep === "/") return p;
    return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
  }

  async function requestReadFile(
    rawBody: string | undefined,
    allowlist: string[],
  ) {
    const { handleCoreRoutesRequest } = await import("../src/register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/readFile";
    req.headers = { "content-type": "application/json" };

    if (rawBody !== undefined) {
      req.push(Buffer.from(rawBody));
      req.push(null);
    }

    let status = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist }, 3001);

    socket.destroy();
    return { status, body: body ? (JSON.parse(body) as Record<string, unknown>) : {} };
  }

  it("returns 200 with data for an existing file in allowlist", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-read-"));
    const filePath = path.join(dir, "a.txt");
    await writeFile(filePath, "hello world", "utf-8");
    try {
      const { status, body } = await requestReadFile(
        JSON.stringify({ path: filePath }),
        [toPosix(dir)],
      );
      expect(status).toBe(200);
      expect(body.error).toBeUndefined();
      expect(body.data).toBe("hello world");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns 200 with allowlist error for an out-of-allowlist path (default)", async () => {
    const { status, body } = await requestReadFile(
      JSON.stringify({ path: "/definitely/outside/allowlist.txt" }),
      ["/allowed-only"],
    );
    expect(status).toBe(200);
    expect(body.data).toBeUndefined();
    expect(body.error).toContain("not in the allowlist");
  });

  it("returns 200 with data when requireValidPath: false skips allowlist", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-read-skip-"));
    const filePath = path.join(dir, "x.txt");
    await writeFile(filePath, "outside", "utf-8");
    try {
      const { status, body } = await requestReadFile(
        JSON.stringify({ path: filePath, requireValidPath: false }),
        ["/allowed-only"],
      );
      expect(status).toBe(200);
      expect(body.error).toBeUndefined();
      expect(body.data).toBe("outside");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns 200 with File Not Found for a missing path", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-read-"));
    try {
      const { status, body } = await requestReadFile(
        JSON.stringify({ path: path.join(dir, "missing.txt") }),
        [toPosix(dir)],
      );
      expect(status).toBe(200);
      expect(body.data).toBeUndefined();
      expect(body.error).toContain("File Not Found");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns 400 for invalid JSON", async () => {
    const { status, body } = await requestReadFile("not-json", []);
    expect(status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 200 with validation error for missing path", async () => {
    const { status, body } = await requestReadFile(JSON.stringify({}), []);
    expect(status).toBe(200);
    expect(body.data).toBeUndefined();
    expect(body.error).toContain("Validation failed");
  });

  it("returns 200 with validation error for empty path", async () => {
    const { status, body } = await requestReadFile(JSON.stringify({ path: "" }), []);
    expect(status).toBe(200);
    expect(body.data).toBeUndefined();
    expect(body.error).toContain("Validation failed");
  });
});

describe("POST /api/deleteFile", () => {
  function toPosix(p: string): string {
    if (path.sep === "/") return p;
    return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
  }

  async function requestDeleteFile(rawBody: string | undefined, allowlist: string[]) {
    const { handleCoreRoutesRequest } = await import("../src/register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/deleteFile";
    req.headers = { "content-type": "application/json" };

    if (rawBody !== undefined) {
      req.push(Buffer.from(rawBody));
      req.push(null);
    }

    let status = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist }, 3001);

    socket.destroy();
    return { status, body: body ? (JSON.parse(body) as Record<string, unknown>) : {} };
  }

  it("deletes an existing file in the allowlist", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-delete-"));
    const filePath = path.join(dir, "doomed.txt");
    await writeFile(filePath, "x", "utf-8");
    try {
      const { status, body } = await requestDeleteFile(
        JSON.stringify({ path: filePath }),
        [toPosix(dir)],
      );
      expect(status).toBe(200);
      expect(body.error).toBeUndefined();
      expect((body.data as { path?: string } | undefined)?.path).toBeTruthy();
      await expect(stat(filePath)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("treats a missing file as idempotent success", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-delete-missing-"));
    try {
      const { status, body } = await requestDeleteFile(
        JSON.stringify({ path: path.join(dir, "ghost.txt") }),
        [toPosix(dir)],
      );
      expect(status).toBe(200);
      expect(body.error).toBeUndefined();
      expect((body.data as { path?: string } | undefined)?.path).toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns allowlist error for an out-of-allowlist path", async () => {
    const { status, body } = await requestDeleteFile(
      JSON.stringify({ path: "/definitely/outside/allowlist.txt" }),
      ["/allowed-only"],
    );
    expect(status).toBe(200);
    expect(body.data).toBeUndefined();
    expect(body.error).toContain("not in the allowlist");
  });

  it("returns 400 for invalid JSON", async () => {
    const { status, body } = await requestDeleteFile("not-json", []);
    expect(status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 200 with validation error for missing path", async () => {
    const { status, body } = await requestDeleteFile(JSON.stringify({}), []);
    expect(status).toBe(200);
    expect(body.data).toBeUndefined();
    expect(body.error).toContain("Validation Failed");
  });

  it("returns 200 with validation error for empty path", async () => {
    const { status, body } = await requestDeleteFile(JSON.stringify({ path: "" }), []);
    expect(status).toBe(200);
    expect(body.data).toBeUndefined();
    expect(body.error).toContain("Validation Failed");
  });
});

describe("POST /api/getEpisodes", () => {
  async function requestGetEpisodes(rawBody: string | undefined) {
    const { handleCoreRoutesRequest } = await import("../src/register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/getEpisodes";
    req.headers = { "content-type": "application/json" };

    if (rawBody !== undefined) {
      req.push(Buffer.from(rawBody));
      req.push(null);
    }

    let status = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist: [] }, 3001);

    socket.destroy();
    return { status, body: body ? (JSON.parse(body) as Record<string, unknown>) : {} };
  }

  it("returns 200 instead of 404 for a valid request body", async () => {
    const { status, body } = await requestGetEpisodes(
      JSON.stringify({ mediaFolderPath: "/tmp/show" }),
    );
    expect(status).toBe(200);
    expect(body.error).toBeTruthy();
  });
});

describe("POST /api/listFilesInMediaFolder", () => {
  async function requestListFilesInMediaFolder(rawBody: string | undefined) {
    const { handleCoreRoutesRequest } = await import("../src/register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/listFilesInMediaFolder";
    req.headers = { "content-type": "application/json" };

    if (rawBody !== undefined) {
      req.push(Buffer.from(rawBody));
      req.push(null);
    }

    let status = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist: [] }, 3001);

    socket.destroy();
    return { status, body: body ? (JSON.parse(body) as Record<string, unknown>) : {} };
  }

  it("returns 200 instead of 404 for a valid request body", async () => {
    const { status, body } = await requestListFilesInMediaFolder(
      JSON.stringify({ mediaFolderPath: "/tmp/show" }),
    );
    expect(status).toBe(200);
    expect(body.error).toBeTruthy();
  });
});

describe("POST /api/renameFolder", () => {
  async function requestRenameFolder(rawBody: string | undefined) {
    const { handleCoreRoutesRequest } = await import("../src/register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/renameFolder";
    req.headers = { "content-type": "application/json" };

    if (rawBody !== undefined) {
      req.push(Buffer.from(rawBody));
      req.push(null);
    }

    let status = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist: [] }, 3001);

    socket.destroy();
    return { status, body: body ? (JSON.parse(body) as Record<string, unknown>) : {} };
  }

  it("returns 200 instead of 404 for a valid request body", async () => {
    const { status, body } = await requestRenameFolder(
      JSON.stringify({
        from: "/tmp/show",
        to: "/tmp/show-renamed",
      }),
    );
    expect(status).toBe(200);
    expect(body.error).toBeTruthy();
  });
});

describe("GET /api/image", () => {
  function makeFetchResponse(opts: {
    status?: number;
    contentType?: string | null;
    body?: Buffer;
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
      arrayBuffer: () => Promise.resolve((opts.body ?? Buffer.alloc(0)).buffer.slice(
        opts.body ? opts.body.byteOffset : 0,
        opts.body ? opts.body.byteOffset + opts.body.byteLength : 0,
      )),
    } as unknown as Response;
  }

  async function requestImage(
    url: string,
    allowlist: string[],
  ): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
    const { handleCoreRoutesRequest } = await import("../src/register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "GET";
    req.url = url;
    req.headers = { host: "localhost:3001" };

    let status = 0;
    let headers: Record<string, string> = {};
    const chunks: Buffer[] = [];
    const res = new ServerResponse(req);
    res.writeHead = ((code: number, hdrs?: Record<string, string>) => {
      status = code;
      headers = hdrs ?? {};
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      }
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist }, 3001);

    socket.destroy();
    return {
      status,
      headers,
      body: Buffer.concat(chunks),
    };
  }

  it("returns the image bytes with the correct Content-Type on success", async () => {
    const payload = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(makeFetchResponse({ contentType: "image/jpeg", body: payload }));
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const { status, headers, body } = await requestImage(
        "/api/image?url=" + encodeURIComponent("https://example.com/x.jpg"),
        [],
      );
      expect(status).toBe(200);
      expect(headers["Content-Type"]).toBe("image/jpeg");
      expect(headers["Cache-Control"]).toBe("public, max-age=31536000");
      expect(Number(headers["Content-Length"])).toBe(payload.length);
      expect(Array.from(body)).toEqual(Array.from(payload));
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://example.com/x.jpg",
        expect.objectContaining({ method: "GET" }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns 400 when url is missing", async () => {
    const { status, body } = await requestImage("/api/image", []);
    expect(status).toBe(400);
    expect(body.toString("utf-8")).toContain("Missing required query parameter: url");
  });

  it("returns 500 for invalid URL protocol", async () => {
    const { status, body } = await requestImage(
      "/api/image?url=" + encodeURIComponent("ftp://example.com/x.jpg"),
      [],
    );
    expect(status).toBe(500);
    expect(body.toString("utf-8")).toContain("Invalid image URL");
  });

  it("defaults to image/jpeg when upstream response has no content-type", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(makeFetchResponse({ contentType: null, body: Buffer.from([1, 2, 3]) }));
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const { status, headers } = await requestImage(
        "/api/image?url=" + encodeURIComponent("https://example.com/x"),
        [],
      );
      expect(status).toBe(200);
      expect(headers["Content-Type"]).toBe("image/jpeg");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns 500 when upstream returns 404", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeFetchResponse({ status: 404 }));
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const { status, body } = await requestImage(
        "/api/image?url=" + encodeURIComponent("https://example.com/nope.jpg"),
        [],
      );
      expect(status).toBe(500);
      expect(body.toString("utf-8")).toContain("HTTP error! status: 404");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("surfaces fetch-failed cause code in the 500 response body", async () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND x"), {
      code: "ENOTFOUND",
    });
    const fetchSpy = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new TypeError("fetch failed"), { cause }),
      );
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const { status, body } = await requestImage(
        "/api/image?url=" + encodeURIComponent("https://example.com/x.jpg"),
        [],
      );
      expect(status).toBe(500);
      const text = body.toString("utf-8");
      expect(text).toContain("Failed to download image");
      expect(text).toContain("ENOTFOUND");
      expect(text).toContain("getaddrinfo");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("serves a file:// URL when the path is in the allowlist", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-image-"));
    try {
      const filePath = path.join(dir, "local.png");
      await writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const posixDir =
        path.sep === "/"
          ? dir
          : dir.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
      const { status, headers, body } = await requestImage(
        "/api/image?url=" + encodeURIComponent(`file://${filePath}`),
        [posixDir],
      );
      expect(status).toBe(200);
      expect(headers["Content-Type"]).toBe("image/png");
      expect(Array.from(body)).toEqual([0x89, 0x50, 0x4e, 0x47]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("POST /api/downloadImage", () => {
  function toPosix(p: string): string {
    if (path.sep === "/") return p;
    return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
  }

  function makeFetchResponse(opts: {
    status?: number;
    body?: Buffer;
  }): Response {
    return {
      ok: opts.status === undefined ? true : opts.status >= 200 && opts.status < 300,
      status: opts.status ?? 200,
      headers: { get: () => null },
      arrayBuffer: () => Promise.resolve((opts.body ?? Buffer.alloc(0)).buffer.slice(
        opts.body ? opts.body.byteOffset : 0,
        opts.body ? opts.body.byteOffset + opts.body.byteLength : 0,
      )),
    } as unknown as Response;
  }

  async function requestDownloadImage(
    rawBody: string | undefined,
    allowlist: string[],
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const { handleCoreRoutesRequest } = await import("../src/register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/downloadImage";
    req.headers = { "content-type": "application/json" };

    if (rawBody !== undefined) {
      req.push(Buffer.from(rawBody));
      req.push(null);
    }

    let status = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist }, 3001);

    socket.destroy();
    return { status, body: body ? (JSON.parse(body) as Record<string, unknown>) : {} };
  }

  it("downloads and writes the file when the destination does not exist", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-dl-as-file-"));
    try {
      const dest = path.join(dir, "new.jpg");
      const payload = Buffer.from("hello-payload", "utf-8");
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(makeFetchResponse({ body: payload }));
      vi.stubGlobal("fetch", fetchSpy);
      try {
        const { status, body } = await requestDownloadImage(
          JSON.stringify({
            url: "https://example.com/x.jpg",
            path: dest,
          }),
          [toPosix(dir)],
        );
        expect(status).toBe(200);
        expect(body.error).toBeUndefined();
        expect((body.data as { url?: string; path?: string } | undefined)?.url).toBe(
          "https://example.com/x.jpg",
        );
        expect((body.data as { url?: string; path?: string } | undefined)?.path).toBe(dest);
        const written = await readFile(dest);
        expect(Array.from(written)).toEqual(Array.from(payload));
      } finally {
        vi.unstubAllGlobals();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns an existedFileError when the destination already exists", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-dl-existing-"));
    try {
      const dest = path.join(dir, "exists.jpg");
      await writeFile(dest, "already", "utf-8");
      const { status, body } = await requestDownloadImage(
        JSON.stringify({
          url: "https://example.com/x.jpg",
          path: dest,
        }),
        [toPosix(dir)],
      );
      expect(status).toBe(200);
      expect(body.error).toMatch(/File Already Existed/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects out-of-allowlist paths", async () => {
    const { status, body } = await requestDownloadImage(
      JSON.stringify({
        url: "https://example.com/x.jpg",
        path: "/etc/passwd.jpg",
      }),
      ["/allowed-only"],
    );
    expect(status).toBe(200);
    expect(body.error).toContain("not in the allowlist");
  });

  it("returns 400 for invalid JSON", async () => {
    const { status, body } = await requestDownloadImage("not-json", []);
    expect(status).toBe(400);
    expect(body.error).toContain("Invalid JSON body");
  });

  it("returns Validation failed for missing url", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-dl-no-url-"));
    try {
      const { status, body } = await requestDownloadImage(
        JSON.stringify({ path: path.join(dir, "x.jpg") }),
        [toPosix(dir)],
      );
      expect(status).toBe(200);
      expect(body.error).toMatch(/Validation failed/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns HTTP error! status: <n> for non-2xx upstream", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-dl-404-"));
    try {
      const dest = path.join(dir, "missing.jpg");
      const fetchSpy = vi.fn().mockResolvedValue(makeFetchResponse({ status: 404 }));
      vi.stubGlobal("fetch", fetchSpy);
      try {
        const { status, body } = await requestDownloadImage(
          JSON.stringify({
            url: "https://example.com/nope.jpg",
            path: dest,
          }),
          [toPosix(dir)],
        );
        expect(status).toBe(200);
        expect(body.error).toContain("HTTP error! status: 404");
      } finally {
        vi.unstubAllGlobals();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("POST /api/readImage", () => {
  function toPosix(p: string): string {
    if (path.sep === "/") return p;
    return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1");
  }

  async function requestReadImage(
    rawBody: string | undefined,
    allowlist: string[],
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const { handleCoreRoutesRequest } = await import("../src/register.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.url = "/api/readImage";
    req.headers = { "content-type": "application/json" };

    if (rawBody !== undefined) {
      req.push(Buffer.from(rawBody));
      req.push(null);
    }

    let status = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : "";
      return res;
    }) as typeof res.end;

    await handleCoreRoutesRequest(req, res, { allowlist }, 3001);

    socket.destroy();
    return { status, body: body ? (JSON.parse(body) as Record<string, unknown>) : {} };
  }

  it("returns a base64 data URL for an allowlisted PNG", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-read-image-"));
    try {
      const filePath = path.join(dir, "img.png");
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await writeFile(filePath, bytes);
      const { status, body } = await requestReadImage(
        JSON.stringify({ path: filePath }),
        [toPosix(dir)],
      );
      expect(status).toBe(200);
      expect(body.error).toBeUndefined();
      expect(typeof body.data).toBe("string");
      expect((body.data as string).startsWith("data:image/png;base64,")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns File Not Found for a missing path", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-read-missing-"));
    try {
      const { status, body } = await requestReadImage(
        JSON.stringify({ path: path.join(dir, "missing.png") }),
        [toPosix(dir)],
      );
      expect(status).toBe(200);
      expect(body.data).toBeUndefined();
      expect((body.error as string | undefined)).toMatch(/File Not Found/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects out-of-allowlist paths", async () => {
    const { status, body } = await requestReadImage(
      JSON.stringify({ path: "/etc/passwd.png" }),
      ["/allowed-only"],
    );
    expect(status).toBe(200);
    expect((body.error as string | undefined)).toContain("not in the allowlist");
  });

  it("rejects non-image extensions", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "core-routes-read-text-"));
    try {
      const filePath = path.join(dir, "notes.txt");
      await writeFile(filePath, "hello", "utf-8");
      const { status, body } = await requestReadImage(
        JSON.stringify({ path: filePath }),
        [toPosix(dir)],
      );
      expect(status).toBe(200);
      expect((body.error as string | undefined)).toContain("not a valid image file");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns 400 for invalid JSON", async () => {
    const { status, body } = await requestReadImage("not-json", []);
    expect(status).toBe(400);
    expect(body.error).toContain("Invalid JSON body");
  });
});
