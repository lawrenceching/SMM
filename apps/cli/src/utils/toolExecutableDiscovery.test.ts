import fs from "fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  resolveAutoToolPath,
  resolveEffectiveToolPath,
} from "./toolExecutableDiscovery";

describe("resolveAutoToolPath priority", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SMM_RESOURCES_PATH;
  });

  it("prefers SMM_RESOURCES_PATH over project bin", () => {
    process.env.SMM_RESOURCES_PATH = "/app/Resources";
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      const s = String(p).replace(/\\/g, "/");
      if (s.endsWith("/app/Resources/bin/yt-dlp/yt-dlp")) return true;
      if (s.endsWith("/bin/yt-dlp/yt-dlp")) return true;
      return false;
    });

    const result = resolveAutoToolPath("yt-dlp", "yt-dlp");
    expect(result?.replace(/\\/g, "/")).toBe("/app/Resources/bin/yt-dlp/yt-dlp");
  });
});

describe("resolveEffectiveToolPath priority", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SMM_RESOURCES_PATH;
  });

  it("prefers bundled path over user config", () => {
    process.env.SMM_RESOURCES_PATH = "/app/Resources";
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      const s = String(p).replace(/\\/g, "/");
      if (s.endsWith("/app/Resources/bin/ffmpeg/ffmpeg")) return true;
      if (s === "/custom/ffmpeg") return true;
      return false;
    });

    const result = resolveEffectiveToolPath("ffmpeg", "ffmpeg", "/custom/ffmpeg");
    expect(result?.replace(/\\/g, "/")).toBe("/app/Resources/bin/ffmpeg/ffmpeg");
  });
});
