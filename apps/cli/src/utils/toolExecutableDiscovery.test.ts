import fs from "fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  findExecutableOnSystemPath,
  resolveAutoToolPath,
  resolveAutoToolPathWithExtras,
  resolveEffectiveToolPath,
} from "./toolExecutableDiscovery";

describe("resolveAutoToolPath priority", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SMM_RESOURCES_PATH;
    delete process.env.PATH;
    delete process.env.Path;
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

  it("falls back to system PATH when bundled, project, and install are missing", () => {
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      const s = String(p).replace(/\\/g, "/");
      return s === "/usr/local/bin/ffmpeg";
    });
    process.env.PATH = "/usr/local/bin";

    const result = resolveAutoToolPath("ffmpeg", "ffmpeg");
    expect(result?.replace(/\\/g, "/")).toMatch(/\/usr\/local\/bin\/ffmpeg$/);
  });
});

describe("findExecutableOnSystemPath", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns first existing executable on PATH", () => {
    const pathEnv =
      process.platform === "win32" ? "C:\\opt\\bin;C:\\other" : "/opt/bin:/other";
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      const s = String(p).replace(/\\/g, "/");
      return s.endsWith("/opt/bin/yt-dlp");
    });

    const result = findExecutableOnSystemPath("yt-dlp", pathEnv);
    expect(result).toBeDefined();
    expect(result!.replace(/\\/g, "/")).toMatch(/\/opt\/bin\/yt-dlp$/);
  });
});

describe("resolveEffectiveToolPath priority", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SMM_RESOURCES_PATH;
  });

  it("prefers user config over bundled path", () => {
    process.env.SMM_RESOURCES_PATH = "/app/Resources";
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      const s = String(p).replace(/\\/g, "/");
      if (s === "/custom/ffmpeg") return true;
      if (s.endsWith("/app/Resources/bin/ffmpeg/ffmpeg")) return true;
      return false;
    });

    const result = resolveEffectiveToolPath("ffmpeg", "ffmpeg", "/custom/ffmpeg");
    expect(result?.replace(/\\/g, "/")).toBe("/custom/ffmpeg");
  });

  it("uses auto chain when user config path does not exist", () => {
    process.env.SMM_RESOURCES_PATH = "/app/Resources";
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      const s = String(p).replace(/\\/g, "/");
      if (s === "/missing/ffmpeg") return false;
      if (s.endsWith("/app/Resources/bin/ffmpeg/ffmpeg")) return true;
      return false;
    });

    const result = resolveEffectiveToolPath("ffmpeg", "ffmpeg", "/missing/ffmpeg");
    expect(result?.replace(/\\/g, "/")).toBe("/app/Resources/bin/ffmpeg/ffmpeg");
  });
});

describe("resolveAutoToolPathWithExtras", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SMM_RESOURCES_PATH;
    delete process.env.PATH;
  });

  it("tries extra candidates after standard auto discovery", () => {
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      const s = String(p).replace(/\\/g, "/");
      return s.endsWith("/python/Scripts/videocaptioner.exe");
    });

    const result = resolveAutoToolPathWithExtras(
      "videocaptioner",
      "videocaptioner.exe",
      ["C:/python/Scripts/videocaptioner.exe"]
    );
    expect(result?.replace(/\\/g, "/")).toBe("C:/python/Scripts/videocaptioner.exe");
  });
});
