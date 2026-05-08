import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertValidBilibiliCollectionUrl,
  parseBilibiliCollectionStdout,
} from "./ytdlp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTION_FIXTURE = join(
  __dirname,
  "../../../../bin/yt-dlp/bilibili-collection-metadata.json"
);

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
  it("parses fixture stdout into metadata", () => {
    const raw = readFileSync(COLLECTION_FIXTURE, "utf-8");
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
