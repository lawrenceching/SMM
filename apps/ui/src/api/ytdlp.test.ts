import { describe, expect, it } from "vitest";
import {
  bilibiliVideoDisplayTitle,
  parseBilibiliVideoStdout,
} from "./ytdlp";

/** Minimal playlist JSON so video-parser tests do not depend on disk fixtures. */
const PLAYLIST_REJECT_STDOUT = JSON.stringify({
  _type: "playlist",
  entries: [],
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
