import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Hono } from "hono";
import {
  COMMAND_LOG_MAX_BYTES,
  handleCommandLog,
  parseOptionalXCommandExecutionId,
  resolveCommandMainLogPath,
} from "./commandLog";

describe("parseOptionalXCommandExecutionId", () => {
  it("returns empty object when header absent", () => {
    expect(parseOptionalXCommandExecutionId(undefined)).toEqual({});
  });

  it("returns empty object when header is whitespace only", () => {
    expect(parseOptionalXCommandExecutionId("   ")).toEqual({});
  });

  it("returns id for valid UUID v4", () => {
    const id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    expect(parseOptionalXCommandExecutionId(id)).toEqual({ id });
  });

  it("returns error when not v4", () => {
    expect(parseOptionalXCommandExecutionId("not-a-uuid")).toEqual({
      error: "Invalid X-Command-Execution-Id",
    });
  });
});

describe("GET /api/command-log/:executionId", () => {
  let prevLogDir: string | undefined;
  let tmpLogRoot: string;
  let app: Hono;

  beforeEach(() => {
    prevLogDir = process.env.LOG_DIR;
    tmpLogRoot = mkdtempSync(path.join(tmpdir(), "smm-cmdlog-read-"));
    process.env.LOG_DIR = tmpLogRoot;
    app = new Hono();
    handleCommandLog(app);
  });

  afterEach(() => {
    if (prevLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = prevLogDir;
    }
    if (existsSync(tmpLogRoot)) {
      rmSync(tmpLogRoot, { recursive: true, force: true });
    }
  });

  it("returns 400 for invalid execution id", async () => {
    const res = await app.request("/api/command-log/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("returns 404 when log file is missing", async () => {
    const id = "00000000-0000-4000-8000-000000000099";
    const res = await app.request(`/api/command-log/${id}`);
    expect(res.status).toBe(404);
  });

  it("returns raw slice with truncation headers", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const logDir = path.join(tmpLogRoot, "commands", id);
    const big = "x".repeat(COMMAND_LOG_MAX_BYTES + 50);
    mkdirSync(logDir, { recursive: true });
    writeFileSync(path.join(logDir, "main.log"), big);

    const res = await app.request(`/api/command-log/${id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Log-Truncated")).toBe("true");
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const text = await res.text();
    expect(text.length).toBe(COMMAND_LOG_MAX_BYTES);
  });

  it("honors offset and limit", async () => {
    const id = "00000000-0000-4000-8000-000000000002";
    const logDir = path.join(tmpLogRoot, "commands", id);
    mkdirSync(logDir, { recursive: true });
    writeFileSync(path.join(logDir, "main.log"), "abcdefghij");

    const res = await app.request(`/api/command-log/${id}?offset=2&limit=4`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("cdef");
    expect(res.headers.get("X-Log-Read-Offset")).toBe("2");
    expect(res.headers.get("X-Log-Read-Limit")).toBe("4");
    expect(res.headers.get("X-Log-Truncated")).toBe("true");
  });

  it("returns the raw main.log text as text/plain", async () => {
    const id = "00000000-0000-4000-8000-000000000003";
    const logDir = path.join(tmpLogRoot, "commands", id);
    const content = `2021-01-01T00:00:00.000Z [SYSTEM] start
2021-01-01T00:00:01.000Z [STDOUT] out
`;
    mkdirSync(logDir, { recursive: true });
    writeFileSync(path.join(logDir, "main.log"), content);

    const res = await app.request(`/api/command-log/${id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(await res.text()).toBe(content);
  });
});

describe("resolveCommandMainLogPath", () => {
  let prevLogDir: string | undefined;
  let tmpLogRoot: string;

  beforeEach(() => {
    prevLogDir = process.env.LOG_DIR;
    tmpLogRoot = mkdtempSync(path.join(tmpdir(), "smm-cmdlog-resolve-"));
    process.env.LOG_DIR = tmpLogRoot;
  });

  afterEach(() => {
    if (prevLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = prevLogDir;
    }
    if (existsSync(tmpLogRoot)) {
      rmSync(tmpLogRoot, { recursive: true, force: true });
    }
  });

  it("returns null for non-v4 uuid", () => {
    expect(resolveCommandMainLogPath("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("returns resolved path for valid v4 id", () => {
    const id = "00000000-0000-4000-8000-000000000004";
    const p = resolveCommandMainLogPath(id);
    expect(p).toBe(path.join(tmpLogRoot, "commands", id, "main.log"));
  });
});
