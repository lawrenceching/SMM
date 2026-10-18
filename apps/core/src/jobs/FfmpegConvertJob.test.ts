import { describe, expect, it, vi } from "vitest";
import type { AppContext, PlatformPorts } from "../types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type { FfmpegPort, FfmpegRunRequest, FfmpegRunResult } from "../ports/FfmpegPort";
import { buildFfmpegConvertArgs } from "../whitelistedCmd/ffmpeg";
import { FfmpegConvertJob, type FfmpegConvertJobOptions } from "./FfmpegConvertJob";
import type { JobOptions } from "./abstract-job";

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
  const options: FfmpegConvertJobOptions & Omit<JobOptions, "type"> = {
    id: "conv-1",
    logDir: context.logDir,
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    printLogToConsole: false,
    callbacks: {},
    folder: "/media/show",
    inputPath: "/media/show/episode.mkv",
    outputPath: "/media/show/episode.mp4",
    outputFormat: "mp4h264",
    preset: "balanced",
    title: "Demo Episode",
  };

  const job = new FfmpegConvertJob(context, ports, options);
  return { job, fs, files, ffmpeg, ports, context, options };
}

describe("FfmpegConvertJob", () => {
  it("succeeds on exit 0 with kind and progress 100", async () => {
    const run = vi.fn(async (): Promise<FfmpegRunResult> => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }));
    const { job } = createJob({ ffmpeg: { run } });

    await job.start();

    expect(run).toHaveBeenCalledOnce();
    expect(job.status).toBe("succeeded");
    const snap = job.toJSON();
    expect(snap.kind).toBe("ffmpeg-convert");
    expect(snap.progress).toBe(100);
  });

  it("calls FfmpegPort.run with command ffmpeg and buildFfmpegConvertArgs", async () => {
    let captured: FfmpegRunRequest | undefined;
    const run = vi.fn(async (req: FfmpegRunRequest): Promise<FfmpegRunResult> => {
      captured = req;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job, options } = createJob({ ffmpeg: { run } });
    const expected = buildFfmpegConvertArgs(
      options.inputPath,
      options.outputPath,
      options.outputFormat,
      options.preset,
      options.imageOptions,
    );

    await job.start();

    expect(captured?.command).toBe("ffmpeg");
    expect(captured?.args).toEqual(expected);
  });

  it("updates progress from stderr Duration and time= before completion", async () => {
    let midwayProgress = -1;
    let midwayEta: number | null | undefined;
    let jobRef: FfmpegConvertJob | undefined;
    const run = vi.fn(async (req: FfmpegRunRequest): Promise<FfmpegRunResult> => {
      req.onStderrLine?.(
        "  Duration: 00:00:10.00, start: 0.000000, bitrate: 1000 kb/s",
      );
      req.onStderrLine?.(
        "frame=  125 fps= 25 q=28.0 size=    1024kB time=00:00:05.00 bitrate=1677.7kbits/s speed=1.0x",
      );
      midwayProgress = jobRef!.toJSON().progress;
      midwayEta = jobRef!.toJSON().etaSeconds;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job } = createJob({ ffmpeg: { run } });
    jobRef = job;

    await job.start();

    expect(midwayProgress).toBe(50);
    expect(midwayEta).toBe(5);
    expect(job.toJSON().progress).toBe(100);
  });

  it("marks failed with stderr when exit code is non-zero", async () => {
    const run = vi.fn(async (): Promise<FfmpegRunResult> => ({
      exitCode: 1,
      stdout: "",
      stderr: "Error: Encoder not found",
    }));
    const { job } = createJob({ ffmpeg: { run } });

    await job.start();

    expect(job.status).toBe("failed");
    expect(job.toJSON().error).toBe("Error: Encoder not found");
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

  it("aborts in-flight run when abort() is called", async () => {
    let seenSignal: AbortSignal | undefined;
    let releaseRun!: () => void;
    const runEntered = new Promise<void>((resolve) => {
      releaseRun = resolve;
    });
    const run = vi.fn(
      async (_req: FfmpegRunRequest, signal: AbortSignal): Promise<FfmpegRunResult> => {
        seenSignal = signal;
        releaseRun();
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
        const err = new Error("aborted");
        (err as Error & { name: string }).name = "AbortError";
        throw err;
      },
    );
    const { job } = createJob({ ffmpeg: { run } });

    const started = job.start();
    await runEntered;
    await job.abort();
    await started;

    expect(seenSignal?.aborted).toBe(true);
    expect(job.status).toBe("aborted");
  });

  it("fails with a clear error when ffmpeg port is missing", async () => {
    const { job } = createJob({ omitFfmpeg: true });

    await job.start();

    expect(job.status).toBe("failed");
    expect(job.toJSON().error).toMatch(/FfmpegPort/i);
  });
});
