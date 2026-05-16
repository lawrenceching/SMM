import { describe, expect, it } from "vitest";
import { parseYtdlpDownloadStdout } from "@core/whitelistedCmd/ytdlp";
import { formatExecuteCmdFailure, truncateStderr } from "./executeCmdToCompletion";

describe("parseYtdlpDownloadStdout", () => {
  it("returns last non-empty line", () => {
    const stdout = "line1\nC:/Downloads/video [id].mp4\n";
    expect(parseYtdlpDownloadStdout(stdout)).toBe("C:/Downloads/video [id].mp4");
  });
});

describe("formatExecuteCmdFailure", () => {
  it("includes stderr excerpt", () => {
    expect(formatExecuteCmdFailure("yt-dlp", 1, "something failed")).toContain("something failed");
  });
});

describe("truncateStderr", () => {
  it("truncates long stderr", () => {
    expect(truncateStderr("a".repeat(600), 100)).toHaveLength(100);
  });
});
