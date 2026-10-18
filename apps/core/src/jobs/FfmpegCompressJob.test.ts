import { describe, expect, it, vi } from "vitest";
import type { AppContext, PlatformPorts } from "../types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type { FfmpegPort, FfmpegRunRequest, FfmpegRunResult } from "../ports/FfmpegPort";
import { buildFfmpegCompressArgs } from "../whitelistedCmd/ffmpeg";
import {
  DEFAULT_FFMPEG_COMPRESS_OPTIONS,
  type FfmpegCompressOptions,
} from "../whitelistedCmd/constants";
import { FfmpegCompressJob, type FfmpegCompressJobOptions } from "./FfmpegCompressJob";
import type { JobOptions } from "./abstract-job";

const FFPROBE_STDOUT = JSON.stringify({
  format: { duration: "10.0" },
  streams: [{ codec_type: "video", width: 1920, height: 1080 }],
});

const TWO_PASS_OPTIONS: FfmpegCompressOptions = {
  ...DEFAULT_FFMPEG_COMPRESS_OPTIONS,
  presetKey: "custom",
  twoPass: true,
  qualityMode: "targetBitrate",
  targetBitrateKbps: 2000,
};

function createFsMock() {
  const files = new Map<string, string>();
  const fs = {
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    readTextFile: vi.fn(async (path: string) => {
      const text = files.get(path);
      if (text === undefined) throw new Error(`missing ${path}`);
      return text;
    }),
    writeTextFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    writeBinaryFile: vi.fn(),
    exists: vi.fn(async (path: string) => files.has(path)),
    listFiles: vi.fn(async () => []),
    listSubdirectories: vi.fn(async () => []),
    deleteFile: vi.fn(async (path: string) => {
      files.delete(path);
    }),
    rename: vi.fn(),
    mkdir: vi.fn(async () => {}),
  } satisfies FsPort;
  return { fs, files };
}

function createJob(overrides: {
  ffmpeg?: FfmpegPort;
  omitFfmpeg?: boolean;
  compressOptions?: FfmpegCompressOptions;
} = {}) {
  const { fs, files } = createFsMock();
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } satisfies LoggerPort;
  const network = { fetch: vi.fn() } satisfies NetworkPort;
  const ffmpeg: FfmpegPort = overrides.ffmpeg ?? {
    run: vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" })),
  };
  const context: AppContext = {
    appDataDir: "/data/smm",
    userDataDir: "/data/smm",
    osLocale: "en-US",
    tmpDir: "/tmp",
    logDir: "/logs",
  };
  const ports: PlatformPorts = {
    fs,
    network,
    logger,
    normalizePosix: (p) => p,
    ...(overrides.omitFfmpeg ? {} : { ffmpeg }),
  };
  const options: FfmpegCompressJobOptions & Omit<JobOptions, "type"> = {
    id: "comp-1",
    logDir: context.logDir,
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    printLogToConsole: false,
    callbacks: {},
    folder: "/media/show",
    inputPath: "/media/show/episode.mkv",
    outputPath: "/media/show/episode.mp4",
    compressOptions: overrides.compressOptions ?? DEFAULT_FFMPEG_COMPRESS_OPTIONS,
    title: "Demo Episode",
  };

  const job = new FfmpegCompressJob(context, ports, options);
  return { job, fs, files, ffmpeg, ports, context, options };
}

function expectedFfprobeArgs(inputPath: string): string[] {
  return [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    inputPath,
  ];
}

describe("FfmpegCompressJob", () => {
  it("single-pass: ffprobe then one ffmpeg; exit 0 → succeeded", async () => {
    const calls: FfmpegRunRequest[] = [];
    const run = vi.fn(async (req: FfmpegRunRequest): Promise<FfmpegRunResult> => {
      calls.push(req);
      if (req.command === "ffprobe") {
        return { exitCode: 0, stdout: FFPROBE_STDOUT, stderr: "" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job, options } = createJob({ ffmpeg: { run } });
    const expectedRun = buildFfmpegCompressArgs(
      options.inputPath,
      options.outputPath,
      options.compressOptions,
      { durationSec: 10, width: 1920, height: 1080 },
    );
    expect(expectedRun.kind).toBe("single");

    await job.start();

    expect(calls).toHaveLength(2);
    expect(calls[0]?.command).toBe("ffprobe");
    expect(calls[0]?.args).toEqual(expectedFfprobeArgs(options.inputPath));
    expect(calls[1]?.command).toBe("ffmpeg");
    if (expectedRun.kind === "single") {
      expect(calls[1]?.args).toEqual(expectedRun.args);
    }
    expect(job.status).toBe("succeeded");
    expect(job.toJSON().progress).toBe(100);
  });

  it("two-pass: two ffmpeg runs; after pass1 progress ≥50; final 100", async () => {
    let progressAfterPass1 = -1;
    let jobRef: FfmpegCompressJob | undefined;
    let ffmpegCall = 0;
    const run = vi.fn(async (req: FfmpegRunRequest): Promise<FfmpegRunResult> => {
      if (req.command === "ffprobe") {
        return { exitCode: 0, stdout: FFPROBE_STDOUT, stderr: "" };
      }
      ffmpegCall += 1;
      if (ffmpegCall === 1) {
        // Capture progress after pass1 completes (before pass2).
        // Job should bump to ≥50 when pass1 finishes.
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      progressAfterPass1 = jobRef!.toJSON().progress;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job, options } = createJob({
      ffmpeg: { run },
      compressOptions: TWO_PASS_OPTIONS,
    });
    jobRef = job;
    const expectedRun = buildFfmpegCompressArgs(
      options.inputPath,
      options.outputPath,
      options.compressOptions,
      { durationSec: 10, width: 1920, height: 1080 },
    );
    expect(expectedRun.kind).toBe("two-pass");

    await job.start();

    const ffmpegCalls = run.mock.calls.filter(([req]) => req.command === "ffmpeg");
    expect(ffmpegCalls).toHaveLength(2);
    if (expectedRun.kind === "two-pass") {
      expect(ffmpegCalls[0]?.[0].args).toEqual(expectedRun.pass1Args);
      expect(ffmpegCalls[1]?.[0].args).toEqual(expectedRun.pass2Args);
    }
    expect(progressAfterPass1).toBeGreaterThanOrEqual(50);
    expect(job.status).toBe("succeeded");
    expect(job.toJSON().progress).toBe(100);
  });

  it("pass1 fail → failed; no pass2 call", async () => {
    let ffmpegCall = 0;
    const run = vi.fn(async (req: FfmpegRunRequest): Promise<FfmpegRunResult> => {
      if (req.command === "ffprobe") {
        return { exitCode: 0, stdout: FFPROBE_STDOUT, stderr: "" };
      }
      ffmpegCall += 1;
      if (ffmpegCall === 1) {
        return { exitCode: 1, stdout: "", stderr: "pass1 encoder error" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job } = createJob({
      ffmpeg: { run },
      compressOptions: TWO_PASS_OPTIONS,
    });

    await job.start();

    const ffmpegCalls = run.mock.calls.filter(([req]) => req.command === "ffmpeg");
    expect(ffmpegCalls).toHaveLength(1);
    expect(job.status).toBe("failed");
    expect(job.toJSON().error).toBe("pass1 encoder error");
  });

  it("aborts when abort is requested before run starts", async () => {
    const run = vi.fn(async (): Promise<FfmpegRunResult> => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }));
    const { job } = createJob({ ffmpeg: { run } });
    job.tryAbort();

    await job.start();

    expect(run).not.toHaveBeenCalled();
    expect(job.status).toBe("aborted");
  });

  it("toJSON().kind is ffmpeg-compress and includes compressOptions", async () => {
    const run = vi.fn(async (req: FfmpegRunRequest): Promise<FfmpegRunResult> => {
      if (req.command === "ffprobe") {
        return { exitCode: 0, stdout: FFPROBE_STDOUT, stderr: "" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job, options } = createJob({ ffmpeg: { run } });

    await job.start();

    const snap = job.toJSON();
    expect(snap.kind).toBe("ffmpeg-compress");
    expect(snap.compressOptions).toEqual(options.compressOptions);
  });

  it("two-pass success: deleteFile(passLogPath) called", async () => {
    const run = vi.fn(async (req: FfmpegRunRequest): Promise<FfmpegRunResult> => {
      if (req.command === "ffprobe") {
        return { exitCode: 0, stdout: FFPROBE_STDOUT, stderr: "" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job, fs, options } = createJob({
      ffmpeg: { run },
      compressOptions: TWO_PASS_OPTIONS,
    });
    const expectedRun = buildFfmpegCompressArgs(
      options.inputPath,
      options.outputPath,
      options.compressOptions,
      { durationSec: 10, width: 1920, height: 1080 },
    );
    expect(expectedRun.kind).toBe("two-pass");

    await job.start();

    if (expectedRun.kind === "two-pass") {
      expect(fs.deleteFile).toHaveBeenCalledWith(expectedRun.passLogPath);
    }
  });

  it("two-pass pass1 fail: deleteFile(passLogPath) still called", async () => {
    let ffmpegCall = 0;
    const run = vi.fn(async (req: FfmpegRunRequest): Promise<FfmpegRunResult> => {
      if (req.command === "ffprobe") {
        return { exitCode: 0, stdout: FFPROBE_STDOUT, stderr: "" };
      }
      ffmpegCall += 1;
      if (ffmpegCall === 1) {
        return { exitCode: 1, stdout: "", stderr: "pass1 fail" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job, fs, options } = createJob({
      ffmpeg: { run },
      compressOptions: TWO_PASS_OPTIONS,
    });
    const expectedRun = buildFfmpegCompressArgs(
      options.inputPath,
      options.outputPath,
      options.compressOptions,
      { durationSec: 10, width: 1920, height: 1080 },
    );

    await job.start();

    if (expectedRun.kind === "two-pass") {
      expect(fs.deleteFile).toHaveBeenCalledWith(expectedRun.passLogPath);
    }
  });
});
