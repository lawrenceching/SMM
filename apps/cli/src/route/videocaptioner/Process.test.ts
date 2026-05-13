import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import fs from "fs";
import { handleVideoCaptionerProcess, processVideoCaptionerProcess } from "./Process";

const h = vi.hoisted(() => ({
  runWhitelistedCommandSync: vi.fn(),
}));

vi.mock("../executeCmd", () => ({
  runWhitelistedCommandSync: h.runWhitelistedCommandSync,
}));

vi.mock("../../../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    child: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
  },
}));

describe("processVideoCaptionerProcess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success when command completes", async () => {
    h.runWhitelistedCommandSync.mockResolvedValue({ success: true });
    const result = await processVideoCaptionerProcess({
      mediaPath: "C:/v.mp4",
      translator: "bing",
      targetLanguage: "en",
    });
    expect(result.success).toBe(true);
    expect(h.runWhitelistedCommandSync).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "videocaptioner",
        timeoutMs: expect.any(Number),
        logMeta: expect.objectContaining({ mediaPath: "C:/v.mp4" }),
      }),
    );
    const call = h.runWhitelistedCommandSync.mock.calls[0][0];
    expect(call.args[0]).toBe("process");
    expect(call.args[1]).toBe("C:/v.mp4");
  });

  it("passes transcribe and synthesize flags in argv", async () => {
    h.runWhitelistedCommandSync.mockResolvedValue({ success: true });
    await processVideoCaptionerProcess({
      mediaPath: "C:/v.mp4",
      asr: "jianying",
      language: "zh",
      format: "ass",
      translator: "bing",
      targetLanguage: "ja",
      noSynthesize: false,
      subtitleMode: "hard",
      quality: "high",
      synthesizeLayout: "target-only",
    });
    const { args } = h.runWhitelistedCommandSync.mock.calls[0][0];
    expect(args).toEqual(
      expect.arrayContaining([
        "process",
        "C:/v.mp4",
        "--asr",
        "jianying",
        "--language",
        "zh",
        "--format",
        "ass",
        "--translator",
        "bing",
        "--target-language",
        "ja",
        "--subtitle-mode",
        "hard",
        "--quality",
        "high",
        "--layout",
        "target-only",
      ]),
    );
  });

  it("returns normalized error when command fails", async () => {
    h.runWhitelistedCommandSync.mockResolvedValue({ error: "boom" });
    const result = await processVideoCaptionerProcess({
      mediaPath: "C:/v.mp4",
      translator: "bing",
      targetLanguage: "en",
    });
    expect(result.error).toBe("boom");
  });

  it("returns file not found when media missing", async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);
    const result = await processVideoCaptionerProcess({
      mediaPath: "C:/missing/not-there.mp4",
      translator: "bing",
      targetLanguage: "en",
    });
    expect(result.error).toContain("file not found");
    expect(h.runWhitelistedCommandSync).not.toHaveBeenCalled();
  });
});

describe("POST /api/videocaptioner/process", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    app = new Hono();
    handleVideoCaptionerProcess(app);
    h.runWhitelistedCommandSync.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 when body is valid", async () => {
    const res = await app.request("/api/videocaptioner/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaPath: "C:/v.mp4",
        translator: "bing",
        targetLanguage: "en",
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success?: boolean };
    expect(json.success).toBe(true);
  });

  it("returns 400 when translator missing and not noTranslate", async () => {
    const res = await app.request("/api/videocaptioner/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaPath: "C:/v.mp4",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid ASR", async () => {
    const res = await app.request("/api/videocaptioner/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaPath: "C:/v.mp4",
        asr: "whisper-api",
        translator: "bing",
        targetLanguage: "en",
      }),
    });
    expect(res.status).toBe(400);
  });
});
