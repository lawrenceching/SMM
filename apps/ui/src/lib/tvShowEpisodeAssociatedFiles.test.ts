import { describe, expect, it } from "vitest";
import { findSubtitles } from "./tvShowEpisodeAssociatedFiles";

describe("findSubtitles", () => {
  const video = "/media/Show/S01E01.mkv";

  it("matches exact stem subtitle files", () => {
    const files = ["/media/Show/S01E01.ass", "/media/Show/S01E02.ass"];
    expect(findSubtitles(files, video)).toEqual(["/media/Show/S01E01.ass"]);
  });

  it("matches language-tagged subtitle files (e.g. S01E01.sc.ass)", () => {
    const files = [
      "/media/Show/S01E01.sc.ass",
      "/media/Show/S01E01.tc.ass",
      "/media/Show/S01E02.sc.ass",
    ];
    expect(findSubtitles(files, video)).toEqual([
      "/media/Show/S01E01.sc.ass",
      "/media/Show/S01E01.tc.ass",
    ]);
  });

  it("matches underscore language-tagged subtitles (e.g. S01E01_zh-Hans.srt)", () => {
    const files = [
      "/media/Show/S01E01.srt",
      "/media/Show/S01E01_zh-Hans.srt",
      "/media/Show/S01E02_zh-Hans.srt",
    ];
    expect(findSubtitles(files, video)).toEqual([
      "/media/Show/S01E01.srt",
      "/media/Show/S01E01_zh-Hans.srt",
    ]);
  });
});

