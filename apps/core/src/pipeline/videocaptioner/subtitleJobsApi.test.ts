import { describe, expect, it } from "vitest";
import {
  assertProcessSubtitleRequest,
  assertSynthesizeSubtitleRequest,
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

describe("assertSynthesizeSubtitleRequest", () => {
  it("trims folder, videoPath, and subtitlePath", () => {
    expect(
      assertSynthesizeSubtitleRequest({
        folder: "  /media  ",
        videoPath: "  video.mp4  ",
        subtitlePath: "  a.srt  ",
      }),
    ).toEqual({
      folder: "/media",
      videoPath: "video.mp4",
      subtitlePath: "a.srt",
    });
  });

  it("rejects empty folder", () => {
    expect(() =>
      assertSynthesizeSubtitleRequest({
        folder: "   ",
        videoPath: "video.mp4",
        subtitlePath: "a.srt",
      }),
    ).toThrow("folder is required");
  });

  it("rejects empty videoPath", () => {
    expect(() =>
      assertSynthesizeSubtitleRequest({
        folder: "/media",
        videoPath: "  ",
        subtitlePath: "a.srt",
      }),
    ).toThrow("videoPath is required");
  });

  it("rejects empty subtitlePath", () => {
    expect(() =>
      assertSynthesizeSubtitleRequest({
        folder: "/media",
        videoPath: "video.mp4",
        subtitlePath: "  ",
      }),
    ).toThrow("subtitlePath is required");
  });
});

describe("assertProcessSubtitleRequest", () => {
  it("trims folder and mediaPath", () => {
    expect(
      assertProcessSubtitleRequest({
        folder: "  /media  ",
        mediaPath: "  video.mp4  ",
      }),
    ).toEqual({ folder: "/media", mediaPath: "video.mp4" });
  });

  it("rejects empty folder", () => {
    expect(() =>
      assertProcessSubtitleRequest({
        folder: "   ",
        mediaPath: "video.mp4",
      }),
    ).toThrow("folder is required");
  });

  it("rejects empty mediaPath", () => {
    expect(() =>
      assertProcessSubtitleRequest({
        folder: "/media",
        mediaPath: "  ",
      }),
    ).toThrow("mediaPath is required");
  });

  it("requires llm.apiKey when translator is llm and translating", () => {
    expect(() =>
      assertProcessSubtitleRequest({
        folder: "/media",
        mediaPath: "video.mp4",
        translator: "llm",
        targetLanguage: "en",
      }),
    ).toThrow("llm.apiKey is required when translator is llm");
  });

  it("skips llm.apiKey when noTranslate", () => {
    expect(
      assertProcessSubtitleRequest({
        folder: "/media",
        mediaPath: "video.mp4",
        translator: "llm",
        noTranslate: true,
      }),
    ).toEqual({ folder: "/media", mediaPath: "video.mp4" });
  });

  it("requires targetLanguage when translating with translator", () => {
    expect(() =>
      assertProcessSubtitleRequest({
        folder: "/media",
        mediaPath: "video.mp4",
        translator: "google",
      }),
    ).toThrow("targetLanguage is required");
  });

  it("accepts translating request with targetLanguage", () => {
    expect(
      assertProcessSubtitleRequest({
        folder: "/media",
        mediaPath: "video.mp4",
        translator: "google",
        targetLanguage: "  zh-CN  ",
      }),
    ).toEqual({ folder: "/media", mediaPath: "video.mp4" });
  });

  it("accepts llm translator with apiKey when translating", () => {
    expect(
      assertProcessSubtitleRequest({
        folder: "/media",
        mediaPath: "video.mp4",
        translator: "llm",
        targetLanguage: "en",
        llm: { apiKey: "sk-test" },
      }),
    ).toEqual({ folder: "/media", mediaPath: "video.mp4" });
  });
});
