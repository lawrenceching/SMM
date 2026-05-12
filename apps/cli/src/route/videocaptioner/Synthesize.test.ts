import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  handleVideoCaptionerSynthesize,
  processVideoCaptionerSynthesize,
} from "./Synthesize";

const h = vi.hoisted(() => ({
  synthesizeWithVideoCaptioner: vi.fn(),
}));

vi.mock("../../utils/VideoCaptioner", () => ({
  synthesizeWithVideoCaptioner: h.synthesizeWithVideoCaptioner,
  VIDEOCAPTIONER_SUBTITLE_LAYOUTS: ["target-above", "source-above", "target-only", "source-only"],
  VIDEOCAPTIONER_SYNTHESIZE_QUALITY: ["ultra", "high", "medium", "low"],
  VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES: ["ass", "rounded"],
  VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES: ["soft", "hard"],
}));

vi.mock("../../../lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe("processVideoCaptionerSynthesize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when command completes", async () => {
    h.synthesizeWithVideoCaptioner.mockResolvedValue({ success: true });
    const result = await processVideoCaptionerSynthesize({
      videoPath: "C:/v.mp4",
      subtitlePath: "C:/v.srt",
    });
    expect(result.success).toBe(true);
    expect(h.synthesizeWithVideoCaptioner).toHaveBeenCalledWith("C:/v.mp4", "C:/v.srt", {});
  });

  it("passes optional flags to synthesizeWithVideoCaptioner", async () => {
    h.synthesizeWithVideoCaptioner.mockResolvedValue({ success: true });
    await processVideoCaptionerSynthesize({
      videoPath: "C:/v.mp4",
      subtitlePath: "C:/v.srt",
      subtitleMode: "hard",
      quality: "high",
      style: "anime",
      renderMode: "rounded",
      layout: "target-only",
    });
    expect(h.synthesizeWithVideoCaptioner).toHaveBeenCalledWith("C:/v.mp4", "C:/v.srt", {
      subtitleMode: "hard",
      quality: "high",
      style: "anime",
      renderMode: "rounded",
      layout: "target-only",
    });
  });

  it("returns normalized error when command fails", async () => {
    h.synthesizeWithVideoCaptioner.mockResolvedValue({ error: "boom" });
    const result = await processVideoCaptionerSynthesize({
      videoPath: "C:/v.mp4",
      subtitlePath: "C:/v.srt",
    });
    expect(result.error).toBe("boom");
  });
});

describe("POST /api/videocaptioner/synthesize", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    handleVideoCaptionerSynthesize(app);
    h.synthesizeWithVideoCaptioner.mockResolvedValue({ success: true });
  });

  it("returns 200 when body is valid", async () => {
    const res = await app.request("/api/videocaptioner/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoPath: "C:/v.mp4",
        subtitlePath: "C:/v.srt",
      }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  it("returns 400 when subtitleMode is invalid", async () => {
    const res = await app.request("/api/videocaptioner/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoPath: "C:/v.mp4",
        subtitlePath: "C:/v.srt",
        subtitleMode: "invalid",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when quality is invalid", async () => {
    const res = await app.request("/api/videocaptioner/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoPath: "C:/v.mp4",
        subtitlePath: "C:/v.srt",
        quality: "mega",
      }),
    });
    expect(res.status).toBe(400);
  });
});
