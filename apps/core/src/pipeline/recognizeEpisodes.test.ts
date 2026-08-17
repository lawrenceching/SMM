import { describe, expect, it } from "vitest";
import type { MediaMetadata } from "@smm/core";
import {
  excludeFiles,
  isVideoFile,
  pattern1,
  pattern2,
  pattern3,
  pattern4,
  recognizeEpisodes,
} from "./recognizeEpisodes";

const S01E01 = "S01E01.mkv";
const CN_RAW = "第1季第5集.mkv";
const CN_PADDED = "第01季第05集.mkv";
const DIVIDER = "Show - 1.mkv";

const episodes = [
  { season: 1, episode: 1 },
  { season: 1, episode: 5 },
];

describe("isVideoFile", () => {
  it("matches known video extensions", () => {
    expect(isVideoFile("/m/a.mkv")).toBe(true);
    expect(isVideoFile("/m/a.srt")).toBe(false);
  });
});

describe("pattern1", () => {
  it("matches SXXEYY", () => {
    expect(pattern1(episodes, ["/m/" + S01E01, "/m/other.mkv"])).toEqual([
      { season: 1, episode: 1, file: "/m/" + S01E01 },
    ]);
  });
});

describe("pattern2", () => {
  it("matches 第X季第Y集", () => {
    expect(pattern2(episodes, ["/m/" + CN_RAW])).toEqual([{ season: 1, episode: 5, file: "/m/" + CN_RAW }]);
  });
});

describe("pattern3", () => {
  it("matches 第XX季第YY集", () => {
    expect(pattern3(episodes, ["/m/" + CN_PADDED])).toEqual([{ season: 1, episode: 5, file: "/m/" + CN_PADDED }]);
  });
});

describe("pattern4", () => {
  it("matches <divider>N.ext for a single-season list", () => {
    expect(pattern4(episodes, ["/m/" + DIVIDER])).toEqual([{ season: 1, episode: 1, file: "/m/" + DIVIDER }]);
  });

  it("refuses to disambiguate multi-season lists", () => {
    expect(pattern4([{ season: 1, episode: 1 }, { season: 2, episode: 1 }], ["/m/" + DIVIDER])).toEqual([]);
  });
});

describe("excludeFiles", () => {
  it("drops Extras and Subtitles", () => {
    expect(
      excludeFiles(["/m/S01E01.mkv", "/m/Extras/interview.mkv", "/m/Subtitles/en.srt"]),
    ).toEqual(["/m/S01E01.mkv"]);
  });
});

describe("recognizeEpisodes", () => {
  it("matches video files to tvShow seasons via SXXEYY", () => {
    const mm: MediaMetadata = {
      mediaFolderPath: "/m/My.Show",
      files: ["/m/My.Show/S01E01.mkv", "/m/My.Show/S01E02.mkv", "/m/My.Show/poster.jpg"],
      tvShow: {
        database: "TMDB",
        id: "1",
        name: "My Show",
        seasons: [
          {
            season: 1,
            name: "Season 1",
            episodes: [
              { season: 1, episode: 1, name: "E1" },
              { season: 1, episode: 2, name: "E2" },
            ],
          },
        ],
      },
    };
    expect(recognizeEpisodes(mm)).toEqual([
      { season: 1, episode: 1, file: "/m/My.Show/S01E01.mkv" },
      { season: 1, episode: 2, file: "/m/My.Show/S01E02.mkv" },
    ]);
  });

  it("returns [] when there is no tvShow", () => {
    const mm: MediaMetadata = { mediaFolderPath: "/m", files: ["/m/S01E01.mkv"] };
    expect(recognizeEpisodes(mm)).toEqual([]);
  });
});
