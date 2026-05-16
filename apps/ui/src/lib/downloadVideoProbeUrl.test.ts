import { describe, it, expect } from "vitest";
import { getDownloadProbeUrl } from "./downloadVideoProbeUrl";

describe("getDownloadProbeUrl", () => {
  const base = {
    url: "https://www.youtube.com/watch?v=main",
    isUrlValid: true,
    isCollectionUrl: false,
    downloadCollectionVideos: false,
    collectionEntries: [],
    selectedCollectionUrls: new Set<string>(),
    downloadEpisodes: false,
    episodes: [],
    selectedEpisodeUrls: new Set<string>(),
  };

  it("returns main URL for single-video mode", () => {
    expect(getDownloadProbeUrl(base)).toBe(base.url);
  });

  it("returns first selected episode in list order", () => {
    expect(
      getDownloadProbeUrl({
        ...base,
        downloadEpisodes: true,
        episodes: [
          { url: "https://www.bilibili.com/video/BV1" },
          { url: "https://www.bilibili.com/video/BV2" },
        ],
        selectedEpisodeUrls: new Set([
          "https://www.bilibili.com/video/BV2",
          "https://www.bilibili.com/video/BV1",
        ]),
      })
    ).toBe("https://www.bilibili.com/video/BV1");
  });

  it("returns first selected collection entry in list order", () => {
    expect(
      getDownloadProbeUrl({
        ...base,
        isCollectionUrl: true,
        downloadCollectionVideos: true,
        collectionEntries: [
          { url: "https://www.bilibili.com/video/BV10" },
          { url: "https://www.bilibili.com/video/BV20" },
        ],
        selectedCollectionUrls: new Set(["https://www.bilibili.com/video/BV20"]),
      })
    ).toBe("https://www.bilibili.com/video/BV20");
  });

  it("returns null when no episode is selected", () => {
    expect(
      getDownloadProbeUrl({
        ...base,
        downloadEpisodes: true,
        episodes: [{ url: "https://www.bilibili.com/video/BV1" }],
        selectedEpisodeUrls: new Set(),
      })
    ).toBeNull();
  });
});
