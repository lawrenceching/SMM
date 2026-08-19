import { describe, expect, it } from "vitest";
import { updateMediaFileMetadatas } from "./updateMediaFileMetadatas";

describe("updateMediaFileMetadatas", () => {
  it("adds a new mapping", () => {
    const next = updateMediaFileMetadatas([], "/m/Show/S01E01.mkv", 1, 1);
    expect(next).toEqual([
      { absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 },
    ]);
  });

  it("replaces same season/episode and same path", () => {
    const prev = [
      { absolutePath: "/m/Show/old.mkv", seasonNumber: 1, episodeNumber: 1 },
      { absolutePath: "/m/Show/S01E02.mkv", seasonNumber: 1, episodeNumber: 2 },
    ];
    const next = updateMediaFileMetadatas(prev, "/m/Show/S01E01.mkv", 1, 1);
    expect(next).toEqual([
      { absolutePath: "/m/Show/S01E02.mkv", seasonNumber: 1, episodeNumber: 2 },
      { absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 },
    ]);
  });
});
