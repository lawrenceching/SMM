import { describe, expect, it } from "vitest";
import { generateNewFileName } from "./renameRules";

describe("generateNewFileName", () => {
  const base = {
    type: "tv" as const,
    seasonNumber: 1,
    episodeNumber: 2,
    episodeName: "Pilot",
    tvshowName: "Show",
    file: "/m/Show/S01E02.mkv",
    releaseYear: "2019",
  };

  it("builds plex relative path", () => {
    expect(generateNewFileName("plex", base)).toBe(
      "Season 01/Show - S01E02 - Pilot.mkv",
    );
  });

  it("builds emby relative path", () => {
    expect(generateNewFileName("emby", base)).toBe(
      "Season 1/Show S1E2 Pilot.mkv",
    );
  });
});
