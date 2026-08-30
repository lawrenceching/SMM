import { describe, expect, it } from "vitest";
import type { MediaMetadata } from "@smm/core";
import { buildTvShowRenamePlanFileEntries } from "./buildTvShowRenamePlanFileEntries";

function mm(partial: Partial<MediaMetadata> & Pick<MediaMetadata, "mediaFolderPath">): MediaMetadata {
  return {
    type: "tvshow-folder",
    mediaFiles: [],
    tvShow: {
      id: "1",
      name: "Show",
      seasons: [
        {
          season: 1,
          episodes: [{ season: 1, episode: 1, name: "Ep1" }],
        },
      ],
    },
    ...partial,
  } as MediaMetadata;
}

describe("buildTvShowRenamePlanFileEntries", () => {
  it("emits from→to for plex when current name differs", () => {
    const meta = mm({
      mediaFolderPath: "/m/Show",
      mediaFiles: [{ absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 }],
    });
    const files = buildTvShowRenamePlanFileEntries(meta, "plex");
    expect(files).toEqual([
      {
        from: "/m/Show/S01E01.mkv",
        to: "/m/Show/Season 01/Show - S01E01 - Ep1.mkv",
      },
    ]);
  });

  it("omits already-matching paths", () => {
    const to = "/m/Show/Season 01/Show - S01E01 - Ep1.mkv";
    const meta = mm({
      mediaFolderPath: "/m/Show",
      mediaFiles: [{ absolutePath: to, seasonNumber: 1, episodeNumber: 1 }],
    });
    expect(buildTvShowRenamePlanFileEntries(meta, "plex")).toEqual([]);
  });
});
