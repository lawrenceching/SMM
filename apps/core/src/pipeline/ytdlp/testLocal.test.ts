import { describe, expect, it } from "vitest";
import {
  buildYtDlpSimulatedError,
  extractTestYtDlpUrl,
  isTestYtDlpUrl,
  parseTestYtDlpUrl,
} from "./testLocal";

describe("parseTestYtDlpUrl", () => {
  it("parses bilibili 412", () => {
    expect(parseTestYtDlpUrl("https://test.local/bilibili/http/412")).toEqual({
      extractor: "bilibili",
      statusCode: 412,
    });
  });

  it("parses youtube 403", () => {
    expect(parseTestYtDlpUrl("https://test.local/youtube/http/403")).toEqual({
      extractor: "youtube",
      statusCode: 403,
    });
  });

  it("returns null for non-test.local host", () => {
    expect(parseTestYtDlpUrl("https://example.com/bilibili/http/412")).toBeNull();
    expect(parseTestYtDlpUrl("http://test.local/bilibili/http/412")).toBeNull();
  });

  it("returns null for invalid path shapes", () => {
    expect(parseTestYtDlpUrl("https://test.local/bilibili")).toBeNull();
    expect(parseTestYtDlpUrl("https://test.local/bilibili/412")).toBeNull();
    expect(parseTestYtDlpUrl("https://test.local/bilibili/http/notanumber")).toBeNull();
  });
});

describe("isTestYtDlpUrl / extractTestYtDlpUrl", () => {
  it("detects and extracts test.local from args", () => {
    const args = ["-J", "https://test.local/bilibili/http/412", "--other"];
    expect(isTestYtDlpUrl(args)).toBe(true);
    expect(extractTestYtDlpUrl(args)).toBe("https://test.local/bilibili/http/412");
  });

  it("returns null when absent", () => {
    expect(isTestYtDlpUrl(["-J", "https://www.bilibili.com/video/BV1"])).toBe(false);
    expect(extractTestYtDlpUrl(["-J", "https://www.bilibili.com/video/BV1"])).toBeNull();
  });
});

describe("buildYtDlpSimulatedError", () => {
  it("builds a yt-dlp-shaped HTTP 412 message", () => {
    const error = buildYtDlpSimulatedError("https://test.local/bilibili/http/412");
    expect(error).toContain("HTTP Error 412");
    expect(error).toContain("BiliBili");
  });

  it("builds a YouTube 403 message", () => {
    const error = buildYtDlpSimulatedError("https://test.local/youtube/http/403");
    expect(error).toContain("HTTP Error 403");
    expect(error).toContain("YouTube");
  });
});
