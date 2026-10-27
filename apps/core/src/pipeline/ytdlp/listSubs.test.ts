import { describe, expect, it, vi } from "vitest";
import type { CommandPort } from "../../ports/CommandPort";
import type { FsPort } from "../../ports/FsPort";
import { listSubtitleLanguagesWithCommand } from "./downloadVideoApi";
import { parseYtdlpListSubsStdout } from "./listSubs";

const LIST_SUBS_STDOUT = `
[youtube] abc: Downloading webpage
[info] Available subtitles for abc:
Language    Name                  Formats
en          English               vtt, srt
zh-Hans     Chinese (Simplified)  vtt, srt
[info] Available automatic captions for abc:
Language    Name      Formats
en          English   vtt
ja          Japanese  vtt
`.trim();

describe("parseYtdlpListSubsStdout", () => {
  it("merges manual and automatic languages by code", () => {
    expect(parseYtdlpListSubsStdout(LIST_SUBS_STDOUT)).toEqual([
      { code: "en", name: "English", kind: "both" },
      { code: "zh-Hans", name: "Chinese (Simplified)", kind: "manual" },
      { code: "ja", name: "Japanese", kind: "auto" },
    ]);
  });

  it("unions languages across playlist sections", () => {
    const stdout = `
[info] Available subtitles for v1:
Language  Name     Formats
en        English  vtt
[info] Available subtitles for v2:
Language  Name      Formats
fr        French    vtt
`.trim();
    expect(parseYtdlpListSubsStdout(stdout).map((lang) => lang.code)).toEqual(["en", "fr"]);
  });

  it("returns an empty list when the video has no subtitles", () => {
    expect(parseYtdlpListSubsStdout("[info] abc has no subtitles\n")).toEqual([]);
  });
});

describe("listSubtitleLanguagesWithCommand", () => {
  const fs = {
    join: (...parts: string[]) => parts.join("/"),
    mkdir: vi.fn(),
    writeTextFile: vi.fn(),
    deleteFile: vi.fn(),
  } as unknown as FsPort;

  it("runs yt-dlp --list-subs and parses languages", async () => {
    const run = vi.fn<CommandPort["run"]>(async () => ({
      exitCode: 0,
      stdout: LIST_SUBS_STDOUT,
      stderr: "",
    }));
    const command: CommandPort = { run };
    const result = await listSubtitleLanguagesWithCommand({
      request: { url: "https://www.bilibili.com/video/BV1", proxy: "http://127.0.0.1:8080" },
      command,
      fs,
      userDataDir: "/data",
      cookiesFileId: "list-subs-1",
    });
    expect(result.languages.map((lang) => lang.code)).toEqual(["en", "zh-Hans", "ja"]);
    const args = run.mock.calls[0]?.[0].args ?? [];
    expect(args).toContain("--list-subs");
    expect(args).toContain("--proxy");
    expect(args.at(-1)).toBe("https://www.bilibili.com/video/BV1");
  });

  it("returns simulated test.local error without CommandPort.run", async () => {
    const run = vi.fn();
    await expect(
      listSubtitleLanguagesWithCommand({
        request: { url: "https://test.local/bilibili/http/412" },
        command: { run },
        fs,
        userDataDir: "/data",
        cookiesFileId: "list-subs-2",
      }),
    ).rejects.toThrow(/http-412/);
    expect(run).not.toHaveBeenCalled();
  });
});
