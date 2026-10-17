import { describe, expect, it } from "vitest";
import {
  buildTranscribeSubtitleArgs,
  buildTranslateSubtitleArgs,
  VIDEOCAPTIONER_DUMMY_API_KEY,
} from "./videocaptioner";

describe("buildTranscribeSubtitleArgs", () => {
  it("builds default bijian/srt argv", () => {
    expect(
      buildTranscribeSubtitleArgs({
        mediaPath: "C:\\media\\a.mp4",
        asr: "bijian",
      }),
    ).toEqual(["transcribe", "C:\\media\\a.mp4", "--asr", "bijian", "--format", "srt"]);
  });

  it("includes language and word-timestamps when set", () => {
    const args = buildTranscribeSubtitleArgs({
      mediaPath: "/m/a.mp4",
      asr: "jianying",
      language: "zh",
      wordTimestamps: true,
      format: "ass",
    });
    expect(args).toContain("--language");
    expect(args).toContain("zh");
    expect(args).toContain("--word-timestamps");
    expect(args).toContain("ass");
  });
});

describe("buildTranslateSubtitleArgs", () => {
  it("adds dummy api-key when llm key absent", () => {
    const args = buildTranslateSubtitleArgs({
      subtitlePath: "/s.srt",
      translator: "bing",
      targetLanguage: "zh-CN",
    });
    expect(args.slice(0, 6)).toEqual([
      "subtitle",
      "/s.srt",
      "--translator",
      "bing",
      "--target-language",
      "zh-CN",
    ]);
    expect(args).toContain("--no-optimize");
    expect(args).toContain("--no-split");
    expect(args).toContain("--api-key");
    expect(args).toContain(VIDEOCAPTIONER_DUMMY_API_KEY);
  });

  it("uses real llm api-key and skips dummy", () => {
    const args = buildTranslateSubtitleArgs({
      subtitlePath: "/s.srt",
      translator: "llm",
      targetLanguage: "en",
      llm: { apiKey: "sk-real", apiBase: "https://api.example", model: "gpt" },
    });
    expect(args).toContain("sk-real");
    expect(args).toContain("--api-base");
    expect(args).not.toContain(VIDEOCAPTIONER_DUMMY_API_KEY);
  });
});
