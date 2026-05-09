import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  handleVideoCaptionerTranscribe,
  processVideoCaptionerTranscribe,
} from "./Transcribe";

const h = vi.hoisted(() => ({
  transcribeWithVideoCaptioner: vi.fn(),
}));

vi.mock("../../utils/VideoCaptioner", () => ({
  transcribeWithVideoCaptioner: h.transcribeWithVideoCaptioner,
  VIDEOCAPTIONER_ASR_ENGINES: ["bijian", "jianying", "whisper-cpp"],
}));

vi.mock("../../../lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("processVideoCaptionerTranscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when command completes", async () => {
    h.transcribeWithVideoCaptioner.mockResolvedValue({ success: true });
    const result = await processVideoCaptionerTranscribe({ mediaPath: "C:/a.mp4" });
    expect(result.success).toBe(true);
    expect(h.transcribeWithVideoCaptioner).toHaveBeenCalledWith("C:/a.mp4", undefined);
  });

  it("passes asr when provided", async () => {
    h.transcribeWithVideoCaptioner.mockResolvedValue({ success: true });
    await processVideoCaptionerTranscribe({ mediaPath: "C:/a.mp4", asr: "jianying" });
    expect(h.transcribeWithVideoCaptioner).toHaveBeenCalledWith("C:/a.mp4", {
      asr: "jianying",
    });
  });

  it("returns normalized error when command fails", async () => {
    h.transcribeWithVideoCaptioner.mockResolvedValue({ error: "boom" });
    const result = await processVideoCaptionerTranscribe({ mediaPath: "C:/a.mp4" });
    expect(result.error).toBe("boom");
  });
});

describe("POST /api/videocaptioner/transcribe", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    handleVideoCaptionerTranscribe(app);
    h.transcribeWithVideoCaptioner.mockResolvedValue({ success: true });
  });

  it("returns 200 when mediaPath is valid and asr omitted", async () => {
    const res = await app.request("/api/videocaptioner/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaPath: "C:/a.mp4" }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  it("returns 200 when asr is whisper-cpp", async () => {
    const res = await app.request("/api/videocaptioner/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaPath: "C:/a.mp4", asr: "whisper-cpp" }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 400 when asr is invalid", async () => {
    const res = await app.request("/api/videocaptioner/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaPath: "C:/a.mp4", asr: "whisper-api" }),
    });
    expect(res.status).toBe(400);
  });
});
