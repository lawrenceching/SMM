import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { handleTencentAsrTranscribe, processTencentAsrTranscribe } from "./Transcribe";

const h = vi.hoisted(() => ({
  transcribeWithTencentAsrHttp: vi.fn(),
}));

vi.mock("../../utils/TencentAsr", () => ({
  transcribeWithTencentAsrHttp: h.transcribeWithTencentAsrHttp,
}));

vi.mock("../../../lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), child: () => ({ error: vi.fn(), warn: vi.fn() }) },
}));

describe("processTencentAsrTranscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when HTTP helper succeeds", async () => {
    h.transcribeWithTencentAsrHttp.mockResolvedValue({ success: true });
    const result = await processTencentAsrTranscribe({
      mediaPath: "C:/a.mp3",
      baseUrl: "https://example.com/asr",
      apiKey: "sk-test",
    });
    expect(result.success).toBe(true);
    expect(h.transcribeWithTencentAsrHttp).toHaveBeenCalledWith({
      mediaPath: "C:/a.mp3",
      baseUrl: "https://example.com/asr",
      apiKey: "sk-test",
    });
  });
});

describe("POST /api/tencent-asr/transcribe", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    handleTencentAsrTranscribe(app);
    h.transcribeWithTencentAsrHttp.mockResolvedValue({ success: true });
  });

  it("returns 200 when body is valid", async () => {
    const res = await app.request("/api/tencent-asr/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaPath: "C:/a.mp3",
        baseUrl: "https://example.com/hook",
        apiKey: "key",
      }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 400 when apiKey is missing", async () => {
    const res = await app.request("/api/tencent-asr/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaPath: "C:/a.mp3",
        baseUrl: "https://example.com/hook",
      }),
    });
    expect(res.status).toBe(400);
  });
});
