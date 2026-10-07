import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const h = vi.hoisted(() => ({
  resolveFfmpegPathInfo: vi.fn(),
  resolveYtdlpPathInfo: vi.fn(),
  resolveVideoCaptionerPathInfo: vi.fn(),
  resolveQuickjsPathInfo: vi.fn(),
}));

vi.mock("../utils/Ffmpeg", () => ({
  resolveFfmpegPathInfo: h.resolveFfmpegPathInfo,
}));

vi.mock("../utils/Ytdlp", () => ({
  resolveYtdlpPathInfo: h.resolveYtdlpPathInfo,
}));

vi.mock("../utils/VideoCaptioner", () => ({
  resolveVideoCaptionerPathInfo: h.resolveVideoCaptionerPathInfo,
}));

vi.mock("../utils/QuickJS", () => ({
  resolveQuickjsPathInfo: h.resolveQuickjsPathInfo,
}));

import { discoverExecutablesRoute, resolveDiscoverExecutables } from "./discoverExecutables";

describe("resolveDiscoverExecutables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns configured and discovered paths separately for all tools", async () => {
    h.resolveFfmpegPathInfo.mockResolvedValue({
      configuredPath: null,
      discoveredPath: "/proj/bin/ffmpeg/ffmpeg",
    });
    h.resolveYtdlpPathInfo.mockResolvedValue({
      configuredPath: "/custom/yt-dlp",
      discoveredPath: "/app/Resources/bin/yt-dlp/yt-dlp",
    });
    h.resolveVideoCaptionerPathInfo.mockResolvedValue({
      configuredPath: "/custom/videocaptioner.exe",
      discoveredPath: "/python/Scripts/videocaptioner.exe",
    });
    h.resolveQuickjsPathInfo.mockResolvedValue({
      configuredPath: null,
      discoveredPath: "/app/Resources/bin/quickjs/qjs",
    });

    const result = await resolveDiscoverExecutables();

    expect(result.data.ffmpeg).toEqual({
      configuredPath: null,
      discoveredPath: "/proj/bin/ffmpeg/ffmpeg",
    });
    expect(result.data.ytdlp).toEqual({
      configuredPath: "/custom/yt-dlp",
      discoveredPath: "/app/Resources/bin/yt-dlp/yt-dlp",
    });
    expect(result.data.videocaptioner).toEqual({
      configuredPath: "/custom/videocaptioner.exe",
      discoveredPath: "/python/Scripts/videocaptioner.exe",
    });
    expect(result.data.quickjs).toEqual({
      configuredPath: null,
      discoveredPath: "/app/Resources/bin/quickjs/qjs",
    });
  });
});

describe("GET /api/discoverExecutables", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = discoverExecutablesRoute;
  });

  it("returns data with all tool path infos", async () => {
    h.resolveFfmpegPathInfo.mockResolvedValue({
      configuredPath: "/ffmpeg",
      discoveredPath: null,
    });
    h.resolveYtdlpPathInfo.mockResolvedValue({
      configuredPath: null,
      discoveredPath: "/yt-dlp",
    });
    h.resolveVideoCaptionerPathInfo.mockResolvedValue({
      configuredPath: null,
      discoveredPath: null,
    });
    h.resolveQuickjsPathInfo.mockResolvedValue({
      configuredPath: null,
      discoveredPath: null,
    });

    const res = await app.request("/api/discoverExecutables");

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data?: Record<string, { configuredPath: string | null; discoveredPath: string | null }>;
    };
    expect(body.data?.ffmpeg).toEqual({ configuredPath: "/ffmpeg", discoveredPath: null });
    expect(body.data?.ytdlp).toEqual({ configuredPath: null, discoveredPath: "/yt-dlp" });
    expect(body.data?.videocaptioner).toEqual({
      configuredPath: null,
      discoveredPath: null,
    });
    expect(body.data?.quickjs).toEqual({ configuredPath: null, discoveredPath: null });
  });
});
