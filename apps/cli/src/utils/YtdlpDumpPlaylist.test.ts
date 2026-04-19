import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { runYtdlpPlaylistDump } from "./Ytdlp";

const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
}));

vi.mock("child_process", async () => {
  const actual =
    await vi.importActual<typeof import("child_process")>("child_process");
  return {
    ...actual,
    spawn: mockSpawn,
  };
});

vi.mock("./config", () => ({
  getUserConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
  };
});

function mockChildWithStdout(
  stdoutBody: string,
  exitCode: number
): ChildProcess {
  const emitter = new EventEmitter();
  const child = emitter as unknown as ChildProcess;
  child.stdout = Readable.from(stdoutBody);
  child.stderr = Readable.from("");
  setImmediate(() => {
    emitter.emit("close", exitCode);
  });
  return child;
}

describe("runYtdlpPlaylistDump", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when url is empty", async () => {
    const result = await runYtdlpPlaylistDump("");
    expect(result).toEqual({ error: "url is required" });
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("returns raw stdout on success", async () => {
    const lines = [
      JSON.stringify({ id: "a", title: "First" }),
      JSON.stringify({ id: "b", title: "Second" }),
    ];
    const body = `${lines.join("\n")}\n`;
    mockSpawn.mockReturnValue(mockChildWithStdout(body, 0));

    const result = await runYtdlpPlaylistDump(
      "https://www.bilibili.com/video/BV1test"
    );

    expect(result).toEqual({ stdout: body });
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      ["-j", "https://www.bilibili.com/video/BV1test"],
      expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] })
    );
  });

  it("preserves blank lines in stdout", async () => {
    const line = JSON.stringify({ id: "only" });
    const body = `\n${line}\n\n`;
    mockSpawn.mockReturnValue(mockChildWithStdout(body, 0));

    const result = await runYtdlpPlaylistDump("https://b23.tv/abc");

    expect(result).toEqual({ stdout: body });
  });

  it("returns error when yt-dlp exits non-zero", async () => {
    const body = `${JSON.stringify({ id: "x" })}\n`;
    mockSpawn.mockReturnValue(mockChildWithStdout(body, 1));

    const result = await runYtdlpPlaylistDump(
      "https://www.bilibili.com/video/BV1test"
    );

    expect("error" in result && result.error).toBeDefined();
    if ("error" in result) {
      expect(result.error).toContain("yt-dlp exited with code 1");
    }
  });

  it("returns empty stdout when process prints nothing and exit is 0", async () => {
    mockSpawn.mockReturnValue(mockChildWithStdout("", 0));

    const result = await runYtdlpPlaylistDump(
      "https://www.bilibili.com/video/BV1test"
    );

    expect(result).toEqual({ stdout: "" });
  });
});
