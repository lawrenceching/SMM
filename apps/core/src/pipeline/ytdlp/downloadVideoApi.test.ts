import { describe, expect, it, vi } from "vitest";
import type { CommandPort } from "../../ports/CommandPort";
import type { FsPort } from "../../ports/FsPort";
import {
  assertDownloadVideoRequest,
  assertValidDownloadUrl,
  inspectVideoWithCommand,
} from "./downloadVideoApi";

describe("assertValidDownloadUrl", () => {
  it("accepts https URLs", () => {
    expect(assertValidDownloadUrl("https://www.bilibili.com/video/BV1")).toContain("bilibili");
  });

  it("rejects empty and non-http", () => {
    expect(() => assertValidDownloadUrl("")).toThrow(/url is required/);
    expect(() => assertValidDownloadUrl("ftp://x")).toThrow(/http or https/);
  });
});

describe("assertDownloadVideoRequest", () => {
  it("requires YouTube cookies", () => {
    expect(() =>
      assertDownloadVideoRequest({
        url: "https://www.youtube.com/watch?v=abc",
        folder: "/dl",
      }),
    ).toThrow(/cookies/);
  });

  it("accepts YouTube with cookiesFromBrowser", () => {
    expect(
      assertDownloadVideoRequest({
        url: "https://www.youtube.com/watch?v=abc",
        folder: "/dl",
        cookiesFromBrowser: "chrome",
      }),
    ).toEqual({
      url: "https://www.youtube.com/watch?v=abc",
      folder: "/dl",
    });
  });
});

describe("inspectVideoWithCommand", () => {
  it("returns simulated test.local error without CommandPort.run", async () => {
    const run = vi.fn();
    const command: CommandPort = { run };
    const fs = {
      join: (...parts: string[]) => parts.join("/"),
      mkdir: vi.fn(),
      writeTextFile: vi.fn(),
      deleteFile: vi.fn(),
    } as unknown as FsPort;

    await expect(
      inspectVideoWithCommand({
        request: { url: "https://test.local/bilibili/http/412" },
        command,
        fs,
        userDataDir: "/data",
        cookiesFileId: "inspect-1",
      }),
    ).rejects.toThrow(/http-412/);
    expect(run).not.toHaveBeenCalled();
  });

  it("parses playlist stdout", async () => {
    const stdout = JSON.stringify({
      _type: "playlist",
      id: "pl1",
      title: "PL",
      entries: [
        { id: "v1", title: "One", formats: [] },
        { id: "v2", title: "Two", formats: [] },
      ],
      epoch: 1,
      _version: { version: "1", current_git_head: null, release_git_head: null, repository: "yt-dlp" },
    });
    const command: CommandPort = {
      run: vi.fn(async () => ({ exitCode: 0, stdout, stderr: "" })),
    };
    const fs = {
      join: (...parts: string[]) => parts.join("/"),
      mkdir: vi.fn(),
      writeTextFile: vi.fn(),
      deleteFile: vi.fn(),
    } as unknown as FsPort;

    const result = await inspectVideoWithCommand({
      request: { url: "https://www.bilibili.com/video/BV1" },
      command,
      fs,
      userDataDir: "/data",
      cookiesFileId: "inspect-2",
    });
    expect(result.video.id).toBe("v1");
    expect(result.playlistEntries).toHaveLength(2);
  });
});
