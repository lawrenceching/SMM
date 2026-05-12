import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  handleVideoCaptionerTranslate,
  processVideoCaptionerTranslate,
} from "./Translate";

const h = vi.hoisted(() => ({
  translateSubtitleWithVideoCaptioner: vi.fn(),
}));

vi.mock("../../utils/VideoCaptioner", () => ({
  translateSubtitleWithVideoCaptioner: h.translateSubtitleWithVideoCaptioner,
  VIDEOCAPTIONER_TRANSLATORS: ["bing", "google", "llm"],
  VIDEOCAPTIONER_SUBTITLE_LAYOUTS: ["target-above", "source-above", "target-only", "source-only"],
}));

vi.mock("../../../lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("processVideoCaptionerTranslate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when command completes", async () => {
    h.translateSubtitleWithVideoCaptioner.mockResolvedValue({ success: true });
    const result = await processVideoCaptionerTranslate({
      subtitlePath: "C:/a.srt",
      translator: "bing",
      targetLanguage: "zh-Hans",
    });
    expect(result.success).toBe(true);
    expect(h.translateSubtitleWithVideoCaptioner).toHaveBeenCalledWith("C:/a.srt", {
      translator: "bing",
      targetLanguage: "zh-Hans",
    });
  });

  it("passes reflect, layout, and llm to translateSubtitleWithVideoCaptioner", async () => {
    h.translateSubtitleWithVideoCaptioner.mockResolvedValue({ success: true });
    await processVideoCaptionerTranslate({
      subtitlePath: "C:/a.srt",
      translator: "llm",
      targetLanguage: "en",
      reflect: true,
      layout: "source-above",
      llm: { apiKey: "sk-x", apiBase: "https://x", model: "m" },
    });
    expect(h.translateSubtitleWithVideoCaptioner).toHaveBeenCalledWith("C:/a.srt", {
      translator: "llm",
      targetLanguage: "en",
      reflect: true,
      layout: "source-above",
      llm: { apiKey: "sk-x", apiBase: "https://x", model: "m" },
    });
  });

  it("returns normalized error when command fails", async () => {
    h.translateSubtitleWithVideoCaptioner.mockResolvedValue({ error: "boom" });
    const result = await processVideoCaptionerTranslate({
      subtitlePath: "C:/a.srt",
      translator: "bing",
      targetLanguage: "en",
    });
    expect(result.error).toBe("boom");
  });
});

describe("POST /api/videocaptioner/translate", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    handleVideoCaptionerTranslate(app);
    h.translateSubtitleWithVideoCaptioner.mockResolvedValue({ success: true });
  });

  it("returns 200 when body is valid", async () => {
    const res = await app.request("/api/videocaptioner/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtitlePath: "C:/a.srt",
        translator: "bing",
        targetLanguage: "zh-Hans",
      }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  it("returns 400 when translator is invalid", async () => {
    const res = await app.request("/api/videocaptioner/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtitlePath: "C:/a.srt",
        translator: "deepl",
        targetLanguage: "en",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when layout is invalid", async () => {
    const res = await app.request("/api/videocaptioner/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtitlePath: "C:/a.srt",
        translator: "bing",
        targetLanguage: "en",
        layout: "invalid",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when subtitlePath is empty", async () => {
    const res = await app.request("/api/videocaptioner/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtitlePath: "",
        translator: "bing",
        targetLanguage: "en",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when translator is llm and llm.apiKey is missing", async () => {
    const res = await app.request("/api/videocaptioner/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtitlePath: "C:/a.srt",
        translator: "llm",
        targetLanguage: "en",
      }),
    });
    expect(res.status).toBe(400);
  });
});
