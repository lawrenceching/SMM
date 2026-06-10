import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
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
    const { status, body } = await requestIsFolderAvailable(
      JSON.stringify({ path: "/definitely/does/not/exist/anywhere" }),
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
