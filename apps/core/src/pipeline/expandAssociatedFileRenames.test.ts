import { describe, expect, it } from "vitest";
import { expandAssociatedFileRenames } from "./expandAssociatedFileRenames";

describe("expandAssociatedFileRenames", () => {
  it("renames same-stem associates in place", () => {
    expect(
      expandAssociatedFileRenames(
        "/m/Show/S01E01.mp4",
        "/m/Show/S01E01_renamed.mp4",
        [
          "/m/Show/S01E01.mp4",
          "/m/Show/S01E01.srt",
          "/m/Show/S01E01.en.srt",
          "/m/Show/S01E01.ass",
          "/m/Show/other.mkv",
        ],
      ),
    ).toEqual([
      { from: "/m/Show/S01E01.srt", to: "/m/Show/S01E01_renamed.srt" },
      { from: "/m/Show/S01E01.en.srt", to: "/m/Show/S01E01_renamed.en.srt" },
      { from: "/m/Show/S01E01.ass", to: "/m/Show/S01E01_renamed.ass" },
    ]);
  });

  it("returns empty when stems are equal", () => {
    expect(
      expandAssociatedFileRenames("/m/Show/S01E01.mp4", "/m/Show/Season 01/S01E01.mp4", [
        "/m/Show/S01E01.mp4",
        "/m/Show/S01E01.srt",
      ]),
    ).toEqual([]);
  });
});
