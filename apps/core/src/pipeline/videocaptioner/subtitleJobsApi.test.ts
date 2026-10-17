import { describe, expect, it } from "vitest";
import {
  assertTranscribeSubtitleRequest,
  assertTranslateSubtitleRequest,
} from "./subtitleJobsApi";

describe("assertTranscribeSubtitleRequest", () => {
  it("trims folder and mediaPath", () => {
    expect(
      assertTranscribeSubtitleRequest({
        folder: "  /media  ",
        mediaPath: "  video.mp4  ",
        asr: "bijian",
      }),
    ).toEqual({ folder: "/media", mediaPath: "video.mp4" });
  });

  it("rejects empty folder", () => {
    expect(() =>
      assertTranscribeSubtitleRequest({
        folder: "   ",
        mediaPath: "video.mp4",
        asr: "bijian",
      }),
    ).toThrow("folder is required");
  });

  it("rejects empty mediaPath", () => {
    expect(() =>
      assertTranscribeSubtitleRequest({
        folder: "/media",
        mediaPath: "  ",
        asr: "whisper-cpp",
      }),
    ).toThrow("mediaPath is required");
  });
});

describe("assertTranslateSubtitleRequest", () => {
  it("trims folder, subtitlePath, and targetLanguage", () => {
    expect(
      assertTranslateSubtitleRequest({
        folder: "  /media  ",
        subtitlePath: "  a.srt  ",
        translator: "google",
        targetLanguage: "  zh-CN  ",
      }),
    ).toEqual({
      folder: "/media",
      subtitlePath: "a.srt",
      targetLanguage: "zh-CN",
    });
  });

  it("requires llm.apiKey when translator is llm", () => {
    expect(() =>
      assertTranslateSubtitleRequest({
        folder: "/media",
        subtitlePath: "a.srt",
        translator: "llm",
        targetLanguage: "en",
      }),
    ).toThrow("llm.apiKey is required when translator is llm");
  });

  it("accepts llm translator with apiKey", () => {
    expect(
      assertTranslateSubtitleRequest({
        folder: "/media",
        subtitlePath: "a.srt",
        translator: "llm",
        targetLanguage: "en",
        llm: { apiKey: "sk-test" },
      }),
    ).toEqual({
      folder: "/media",
      subtitlePath: "a.srt",
      targetLanguage: "en",
    });
  });
});
