import { describe, it, expect } from "vitest";
import { applyRenamePairsToUIMediaMetadata } from "./applyRenamePairsToUIMediaMetadata";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";

describe("applyRenamePairsToUIMediaMetadata", () => {
  it("remaps mediaFiles and files paths", () => {
    const meta = {
      mediaFolderPath: "/show",
      type: "tvshow-folder" as const,
      status: "ok" as const,
      files: ["/show/old.mkv", "/show/old.srt"],
      mediaFiles: [
        {
          absolutePath: "/show/old.mkv",
          seasonNumber: 1,
          episodeNumber: 1,
          subtitleFilePaths: ["/show/old.srt"],
        },
      ],
    } satisfies UIMediaMetadata;

    const next = applyRenamePairsToUIMediaMetadata(meta, [
      { from: "/show/old.mkv", to: "/show/new.mkv" },
      { from: "/show/old.srt", to: "/show/new.srt" },
    ]);

    expect(next.files).toEqual(["/show/new.mkv", "/show/new.srt"]);
    expect(next.mediaFiles?.[0]?.absolutePath).toBe("/show/new.mkv");
    expect(next.mediaFiles?.[0]?.subtitleFilePaths).toEqual(["/show/new.srt"]);
  });
});
