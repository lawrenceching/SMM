import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import type { ChildProcess } from "child_process";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { runWhitelistedCommandSync } from "./executeCmd";

const h = vi.hoisted(() => ({
  discoverFfmpeg: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("child_process", () => ({
  spawn: h.spawn,
}));

vi.mock("../utils/Ffmpeg", () => ({
  discoverFfmpeg: h.discoverFfmpeg,
  discoverFfprobe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/Ytdlp", () => ({
  discoverYtdlp: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/VideoCaptioner", () => ({
  discoverVideoCaptioner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  },
}));

function fakeChild(exitCode: number | null): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  child.stdout = { setEncoding: vi.fn(), on: vi.fn() } as unknown as ChildProcess["stdout"];
  child.stderr = { setEncoding: vi.fn(), on: vi.fn() } as unknown as ChildProcess["stderr"];
  child.kill = vi.fn();
  queueMicrotask(() => child.emit("close", exitCode));
  return child;
}

describe("runWhitelistedCommandSync", () => {
  let prevLogDir: string | undefined;
  let tmpLogRoot: string;

  beforeEach(() => {
    vi.clearAllMocks();
    prevLogDir = process.env.LOG_DIR;
    tmpLogRoot = mkdtempSync(path.join(tmpdir(), "smm-sync-cmd-"));
    process.env.LOG_DIR = tmpLogRoot;
    h.discoverFfmpeg.mockResolvedValue("C:/bin/ffmpeg.exe");
    h.spawn.mockImplementation(() => fakeChild(0));
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

  it("returns executionId and logRelativePath on success", async () => {
    const result = await runWhitelistedCommandSync({
      command: "ffmpeg",
      args: ["-version"],
      timeoutMs: 5000,
    });
    expect(result.success).toBe(true);
    expect(result.executionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.logRelativePath).toMatch(/^commands\//);
    expect(result.logRelativePath).toContain(result.executionId!);
  });

  it("returns correlation fields on non-zero exit", async () => {
    h.spawn.mockImplementation(() => fakeChild(1));
    const result = await runWhitelistedCommandSync({
      command: "ffmpeg",
      args: ["-h"],
      timeoutMs: 5000,
    });
    expect(result.error).toBeDefined();
    expect(result.executionId).toBeDefined();
    expect(result.logRelativePath).toBeDefined();
  });

  it("uses supplied executionId when valid v4", async () => {
    const fixed = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const result = await runWhitelistedCommandSync({
      command: "ffmpeg",
      args: ["-version"],
      timeoutMs: 5000,
      executionId: fixed,
    });
    expect(result.success).toBe(true);
    expect(result.executionId).toBe(fixed);
    expect(result.logRelativePath).toContain(fixed);
  });

  it("ignores invalid executionId and generates a new id", async () => {
    const result = await runWhitelistedCommandSync({
      command: "ffmpeg",
      args: ["-version"],
      timeoutMs: 5000,
      executionId: "not-a-uuid",
    });
    expect(result.success).toBe(true);
    expect(result.executionId).not.toBe("not-a-uuid");
    expect(result.executionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
