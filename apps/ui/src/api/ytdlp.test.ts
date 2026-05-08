import { describe, expect, it } from "vitest";
import {
  assertValidBilibiliCollectionUrl,
  bilibiliVideoDisplayTitle,
  parseBilibiliCollectionStdout,
  parseBilibiliVideoStdout,
} from "./ytdlp";

/** Shape-compatible subset of yt-dlp `-J` playlist output for collection lists (no repo fixture file). */
function minimalCollectionPlaylistStdout(): string {
  const entries = Array.from({ length: 5 }, (_, i) => ({
    ie_key: "BiliBili",
    id: i === 0 ? "BV1AFwczFEGu" : `BVstub${i}`,
    _type: "url",
    url: `https://www.bilibili.com/video/${i === 0 ? "BV1AFwczFEGu" : `BVstub${i}`}`,
  }));
  return JSON.stringify({
    _type: "playlist",
    extractor_key: "BilibiliCollectionList",
    playlist_count: 5,
    webpage_url: "https://space.bilibili.com/131560419/lists/7780118",
    entries,
  });
}

/** Minimal playlist JSON so video-parser tests do not depend on disk fixtures. */
const PLAYLIST_REJECT_STDOUT = JSON.stringify({
  _type: "playlist",
  entries: [],
});

describe("assertValidBilibiliCollectionUrl", () => {
  it("accepts a standard collection URL", () => {
    expect(
      assertValidBilibiliCollectionUrl(
        "https://space.bilibili.com/131560419/lists/7780118"
      )
    ).toBe("https://space.bilibili.com/131560419/lists/7780118");
  });

  it("accepts trailing slash and strips it from result", () => {
    expect(
      assertValidBilibiliCollectionUrl(
        "https://space.bilibili.com/131560419/lists/7780118/"
      )
    ).toBe("https://space.bilibili.com/131560419/lists/7780118");
  });

  it("rejects http", () => {
    expect(() =>
      assertValidBilibiliCollectionUrl(
        "http://space.bilibili.com/131560419/lists/7780118"
      )
    ).toThrow(/https/);
  });

  it("rejects wrong host", () => {
    expect(() =>
      assertValidBilibiliCollectionUrl("https://www.bilibili.com/video/BVxxx")
    ).toThrow(/space\.bilibili\.com/);
  });

  it("accepts collection URL with query parameters", () => {
    expect(
      assertValidBilibiliCollectionUrl(
        "https://space.bilibili.com/131560419/lists/7780118?type=season"
      )
    ).toBe(
      "https://space.bilibili.com/131560419/lists/7780118?type=season"
    );
  });

  it("accepts collection URL with query and trailing slash before query", () => {
    expect(
      assertValidBilibiliCollectionUrl(
        "https://space.bilibili.com/131560419/lists/7780118/?type=season"
      )
    ).toBe(
      "https://space.bilibili.com/131560419/lists/7780118?type=season"
    );
  });

  it("rejects non-collection paths", () => {
    expect(() =>
      assertValidBilibiliCollectionUrl(
        "https://space.bilibili.com/131560419/video/tid"
      )
    ).toThrow(/lists/);
  });
});

describe("parseBilibiliCollectionStdout", () => {
  it("parses playlist-shaped stdout into metadata", () => {
    const raw = minimalCollectionPlaylistStdout();
    const meta = parseBilibiliCollectionStdout(raw);

    expect(meta._type).toBe("playlist");
    expect(meta.extractor_key).toBe("BilibiliCollectionList");
    expect(meta.playlist_count).toBe(5);
    expect(meta.entries).toHaveLength(5);
    expect(meta.entries[0]?.id).toBe("BV1AFwczFEGu");
    expect(meta.webpage_url).toContain("131560419/lists/7780118");
  });

  it("throws on empty stdout", () => {
    expect(() => parseBilibiliCollectionStdout("   ")).toThrow(/empty/);
  });

  it("throws when JSON is not a playlist", () => {
    expect(() => parseBilibiliCollectionStdout('{"_type":"video"}')).toThrow(
      /playlist/
    );
  });
});

const SAMPLE_VIDEO_JSON = `{
  "_type": "video",
  "id": "BV1Sample01",
  "title": "Episode title",
  "fulltitle": "Full episode title",
  "webpage_url": "https://www.bilibili.com/video/BV1Sample01"
}`;

describe("parseBilibiliVideoStdout", () => {
  it("parses single-video JSON", () => {
    const meta = parseBilibiliVideoStdout(SAMPLE_VIDEO_JSON);
    expect(meta._type).toBe("video");
    expect(meta.id).toBe("BV1Sample01");
    expect(meta.title).toBe("Episode title");
    expect(meta.fulltitle).toBe("Full episode title");
    expect(bilibiliVideoDisplayTitle(meta)).toBe("Full episode title");
  });

  it("rejects playlist-shaped stdout", () => {
    expect(() => parseBilibiliVideoStdout(PLAYLIST_REJECT_STDOUT)).toThrow(
      /playlist/
    );
  });

  it("throws on empty stdout", () => {
    expect(() => parseBilibiliVideoStdout("   ")).toThrow(/empty/);
  });
});
