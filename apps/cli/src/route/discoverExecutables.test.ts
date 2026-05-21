import { describe, expect, it, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  resolveFfmpegPathInfo: vi.fn(),
  resolveYtdlpPathInfo: vi.fn(),
  discoverVideoCaptioner: vi.fn(),
}));

vi.mock("../utils/Ffmpeg", () => ({
  resolveFfmpegPathInfo: h.resolveFfmpegPathInfo,
}));

vi.mock("../utils/Ytdlp", () => ({
  resolveYtdlpPathInfo: h.resolveYtdlpPathInfo,
}));

vi.mock("../utils/VideoCaptioner", () => ({
  discoverVideoCaptioner: h.discoverVideoCaptioner,
}));

import { resolveDiscoverExecutables } from "./discoverExecutables";

describe("resolveDiscoverExecutables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns configured and discovered paths separately", async () => {
    h.resolveFfmpegPathInfo.mockResolvedValue({
      configuredPath: null,
      discoveredPath: "/proj/bin/ffmpeg/ffmpeg",
    });
    h.resolveYtdlpPathInfo.mockResolvedValue({
      configuredPath: "/custom/yt-dlp",
      discoveredPath: "/app/Resources/bin/yt-dlp/yt-dlp",
    });
    h.discoverVideoCaptioner.mockResolvedValue(undefined);

    const result = await resolveDiscoverExecutables();

    expect(result.data?.ffmpeg).toEqual({
      configuredPath: null,
      discoveredPath: "/proj/bin/ffmpeg/ffmpeg",
    });
    expect(result.data?.ytdlp).toEqual({
      configuredPath: "/custom/yt-dlp",
      discoveredPath: "/app/Resources/bin/yt-dlp/yt-dlp",
    });
  });
});
