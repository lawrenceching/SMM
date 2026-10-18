import { describe, expect, it, vi } from "vitest";
import { Core } from "../../Core";
import type { FsPort } from "../../ports/FsPort";
import type { NetworkPort } from "../../ports/NetworkPort";
import type { FfmpegPort } from "../../ports/FfmpegPort";
import { DEFAULT_FFMPEG_COMPRESS_OPTIONS } from "../../whitelistedCmd/constants";
import {
  assertFfmpegCompressRequest,
  assertFfmpegConvertRequest,
} from "./ffmpegJobsApi";

function inMemoryFs(): FsPort {
  const files = new Map<string, string>();
  return {
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    readTextFile: vi.fn(async (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`ENOENT: ${path}`);
      return value;
    }),
    writeTextFile: vi.fn(async (path, content) => {
      files.set(path, content);
    }),
    writeBinaryFile: vi.fn(async () => {}),
    exists: vi.fn(async (path) => files.has(path)),
    listFiles: vi.fn(async () => []),
    listSubdirectories: vi.fn(async () => []),
    deleteFile: vi.fn(async (path) => {
      files.delete(path);
    }),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
  };
}

const network: NetworkPort = {
  fetch: vi.fn(async () => {
    throw new Error("Unexpected network request");
  }),
};

const ffmpeg: FfmpegPort = {
  run: vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" })),
};

describe("assertFfmpegConvertRequest", () => {
  it("trims folder, inputPath, and outputPath", () => {
    expect(
      assertFfmpegConvertRequest({
        folder: "  /media  ",
        inputPath: "  in.mkv  ",
        outputPath: "  out.mp4  ",
        outputFormat: "mp4h264",
        preset: "balanced",
      }),
    ).toEqual({
      folder: "/media",
      inputPath: "in.mkv",
      outputPath: "out.mp4",
    });
  });

  it("rejects empty folder", () => {
    expect(() =>
      assertFfmpegConvertRequest({
        folder: "   ",
        inputPath: "in.mkv",
        outputPath: "out.mp4",
        outputFormat: "mp4h264",
        preset: "balanced",
      }),
    ).toThrow("folder is required");
  });

  it("rejects empty inputPath", () => {
    expect(() =>
      assertFfmpegConvertRequest({
        folder: "/media",
        inputPath: "  ",
        outputPath: "out.mp4",
        outputFormat: "mp4h264",
        preset: "balanced",
      }),
    ).toThrow("inputPath is required");
  });

  it("rejects empty outputPath", () => {
    expect(() =>
      assertFfmpegConvertRequest({
        folder: "/media",
        inputPath: "in.mkv",
        outputPath: "  ",
        outputFormat: "mp4h264",
        preset: "balanced",
      }),
    ).toThrow("outputPath is required");
  });

  it("rejects compress-* outputFormat", () => {
    expect(() =>
      assertFfmpegConvertRequest({
        folder: "/media",
        inputPath: "in.mkv",
        outputPath: "out.mp4",
        outputFormat: "compress-mp4",
        preset: "balanced",
      }),
    ).toThrow(/compress/i);
  });
});

describe("assertFfmpegCompressRequest", () => {
  it("trims folder, inputPath, and outputPath", () => {
    expect(
      assertFfmpegCompressRequest({
        folder: "  /media  ",
        inputPath: "  in.mkv  ",
        outputPath: "  out.mp4  ",
        compressOptions: DEFAULT_FFMPEG_COMPRESS_OPTIONS,
      }),
    ).toEqual({
      folder: "/media",
      inputPath: "in.mkv",
      outputPath: "out.mp4",
    });
  });

  it("rejects empty folder", () => {
    expect(() =>
      assertFfmpegCompressRequest({
        folder: "   ",
        inputPath: "in.mkv",
        outputPath: "out.mp4",
        compressOptions: DEFAULT_FFMPEG_COMPRESS_OPTIONS,
      }),
    ).toThrow("folder is required");
  });

  it("rejects empty inputPath", () => {
    expect(() =>
      assertFfmpegCompressRequest({
        folder: "/media",
        inputPath: "  ",
        outputPath: "out.mp4",
        compressOptions: DEFAULT_FFMPEG_COMPRESS_OPTIONS,
      }),
    ).toThrow("inputPath is required");
  });

  it("rejects empty outputPath", () => {
    expect(() =>
      assertFfmpegCompressRequest({
        folder: "/media",
        inputPath: "in.mkv",
        outputPath: "  ",
        compressOptions: DEFAULT_FFMPEG_COMPRESS_OPTIONS,
      }),
    ).toThrow("outputPath is required");
  });

  it("rejects missing compressOptions object", () => {
    expect(() =>
      assertFfmpegCompressRequest({
        folder: "/media",
        inputPath: "in.mkv",
        outputPath: "out.mp4",
        compressOptions: null as unknown as typeof DEFAULT_FFMPEG_COMPRESS_OPTIONS,
      }),
    ).toThrow("compressOptions is required");
  });

  it("rejects compressOptions without container", () => {
    expect(() =>
      assertFfmpegCompressRequest({
        folder: "/media",
        inputPath: "in.mkv",
        outputPath: "out.mp4",
        compressOptions: {
          ...DEFAULT_FFMPEG_COMPRESS_OPTIONS,
          container: "" as unknown as "mp4",
        },
      }),
    ).toThrow("compressOptions.container is required");
  });

  it("rejects compressOptions without videoEncoder", () => {
    expect(() =>
      assertFfmpegCompressRequest({
        folder: "/media",
        inputPath: "in.mkv",
        outputPath: "out.mp4",
        compressOptions: {
          ...DEFAULT_FFMPEG_COMPRESS_OPTIONS,
          videoEncoder: "",
        },
      }),
    ).toThrow("compressOptions.videoEncoder is required");
  });
});

describe("Core.ffmpegConvert / Core.ffmpegCompress", () => {
  function createCore(): Core {
    return new Core({
      context: {
        appDataDir: "/data/internal",
        userDataDir: "/data/config",
        tmpDir: "/tmp",
        logDir: "/logs",
      },
      ports: {
        fs: inMemoryFs(),
        network,
        ffmpeg,
      },
    });
  }

  it("ffmpegConvert returns a job id", async () => {
    const core = createCore();
    const handle = await core.ffmpegConvert({
      folder: "/media",
      inputPath: "/media/in.mkv",
      outputPath: "/media/out.mp4",
      outputFormat: "mp4h264",
      preset: "balanced",
    });
    expect(handle.id).toBeTruthy();
    expect(typeof handle.id).toBe("string");
  });

  it("ffmpegCompress returns a job id", async () => {
    const core = createCore();
    const handle = await core.ffmpegCompress({
      folder: "/media",
      inputPath: "/media/in.mkv",
      outputPath: "/media/out.mp4",
      compressOptions: DEFAULT_FFMPEG_COMPRESS_OPTIONS,
    });
    expect(handle.id).toBeTruthy();
    expect(typeof handle.id).toBe("string");
  });

  it("ffmpegConvert requires FfmpegPort", async () => {
    const core = new Core({
      context: {
        appDataDir: "/data/internal",
        userDataDir: "/data/config",
        tmpDir: "/tmp",
        logDir: "/logs",
      },
      ports: {
        fs: inMemoryFs(),
        network,
      },
    });
    await expect(
      core.ffmpegConvert({
        folder: "/media",
        inputPath: "/media/in.mkv",
        outputPath: "/media/out.mp4",
        outputFormat: "mp4h264",
        preset: "balanced",
      }),
    ).rejects.toThrow(/FfmpegPort/i);
  });
});
