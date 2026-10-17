import { describe, expect, it, vi } from "vitest";
import type { AppContext, PlatformPorts } from "../types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type {
  VideoCaptionerPort,
  VideoCaptionerRunRequest,
  VideoCaptionerRunResult,
} from "../ports/VideoCaptionerPort";
import { buildTranscribeSubtitleArgs } from "../whitelistedCmd/videocaptioner";
import { TranscribeSubtitleJob, type TranscribeSubtitleJobOptions } from "./TranscribeSubtitleJob";
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
  videoCaptioner?: VideoCaptionerPort;
  omitVideoCaptioner?: boolean;
} = {}) {
  const { fs, files } = createFsMock();
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } satisfies LoggerPort;
  const network = { fetch: vi.fn() } satisfies NetworkPort;
  const videoCaptioner: VideoCaptionerPort = overrides.videoCaptioner ?? {
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
    ...(overrides.omitVideoCaptioner ? {} : { videoCaptioner }),
  };
  const options: TranscribeSubtitleJobOptions & Omit<JobOptions, "type"> = {
    id: "ts-1",
    logDir: context.logDir,
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    printLogToConsole: false,
    callbacks: {},
    folder: "/media/show",
    mediaPath: "/media/show/episode.mp4",
    title: "Demo Episode",
    asr: "bijian",
    language: "zh",
    wordTimestamps: true,
    format: "srt",
  };

  const job = new TranscribeSubtitleJob(context, ports, options);
  return { job, fs, files, videoCaptioner, ports, context, options };
}

describe("TranscribeSubtitleJob", () => {
  it("succeeds on exit 0 with kind and progress 100", async () => {
    const run = vi.fn(async (): Promise<VideoCaptionerRunResult> => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }));
    const { job } = createJob({ videoCaptioner: { run } });

    await job.start();

    expect(run).toHaveBeenCalledOnce();
    expect(job.status).toBe("succeeded");
    const snap = job.toJSON();
    expect(snap.kind).toBe("transcribe-subtitle");
    expect(snap.progress).toBe(100);
  });

  it("calls VideoCaptionerPort.run with buildTranscribeSubtitleArgs shape", async () => {
    let capturedArgs: string[] = [];
    const run = vi.fn(async (req: VideoCaptionerRunRequest): Promise<VideoCaptionerRunResult> => {
      capturedArgs = req.args;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job, options } = createJob({ videoCaptioner: { run } });
    const expected = buildTranscribeSubtitleArgs({
      mediaPath: options.mediaPath,
      asr: options.asr,
      language: options.language,
      wordTimestamps: options.wordTimestamps,
      format: options.format,
    });

    await job.start();

    expect(capturedArgs).toEqual(expected);
  });

  it("marks failed with stderr when exit code is non-zero", async () => {
    const run = vi.fn(async (): Promise<VideoCaptionerRunResult> => ({
      exitCode: 1,
      stdout: "",
      stderr: "ERROR: ASR engine failed",
    }));
    const { job } = createJob({ videoCaptioner: { run } });

    await job.start();

    expect(job.status).toBe("failed");
    expect(job.toJSON().error).toBe("ERROR: ASR engine failed");
  });

  it("aborts in-flight run when abort() is called", async () => {
    let seenSignal: AbortSignal | undefined;
    let releaseRun!: () => void;
    const runEntered = new Promise<void>((resolve) => {
      releaseRun = resolve;
    });
    const run = vi.fn(
      async (_req: VideoCaptionerRunRequest, signal: AbortSignal): Promise<VideoCaptionerRunResult> => {
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
    const { job } = createJob({ videoCaptioner: { run } });

    const started = job.start();
    await runEntered;
    await job.abort();
    await started;

    expect(seenSignal?.aborted).toBe(true);
    expect(job.status).toBe("aborted");
  });

  it("fails with a clear error when videoCaptioner port is missing", async () => {
    const { job } = createJob({ omitVideoCaptioner: true });

    await job.start();

    expect(job.status).toBe("failed");
    expect(job.toJSON().error).toMatch(/VideoCaptionerPort/i);
  });
});
