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
import {
  buildVideoCaptionerProcessArgs,
  processJobDataToCliOptions,
} from "../whitelistedCmd/videocaptioner";
import { ProcessSubtitleJob, type ProcessSubtitleJobOptions } from "./ProcessSubtitleJob";
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
  options?: Partial<ProcessSubtitleJobOptions>;
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
  const options: ProcessSubtitleJobOptions & Omit<JobOptions, "type"> = {
    id: "proc-1",
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
    noOptimize: true,
    noSplit: true,
    translator: "google",
    targetLanguage: "en",
    reflect: true,
    layout: "target-above",
    prompt: "keep names",
    noSynthesize: false,
    subtitleMode: "soft",
    quality: "high",
    style: "default",
    renderMode: "ass",
    synthesizeLayout: "target-above",
    ...overrides.options,
  };

  const job = new ProcessSubtitleJob(context, ports, options);
  return { job, fs, files, videoCaptioner, ports, context, options };
}

describe("ProcessSubtitleJob", () => {
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
    expect(snap.kind).toBe("process-subtitle");
    expect(snap.progress).toBe(100);
  });

  it("calls VideoCaptionerPort.run with buildVideoCaptionerProcessArgs shape", async () => {
    let capturedArgs: string[] = [];
    const run = vi.fn(async (req: VideoCaptionerRunRequest): Promise<VideoCaptionerRunResult> => {
      capturedArgs = req.args;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job, options } = createJob({ videoCaptioner: { run } });
    const expected = buildVideoCaptionerProcessArgs(
      options.mediaPath,
      processJobDataToCliOptions({
        asr: options.asr,
        language: options.language,
        wordTimestamps: options.wordTimestamps,
        format: options.format,
        noOptimize: options.noOptimize,
        noSplit: options.noSplit,
        noTranslate: options.noTranslate,
        translator: options.translator,
        targetLanguage: options.targetLanguage,
        reflect: options.reflect,
        layout: options.layout,
        prompt: options.prompt,
        llm: options.llm,
        noSynthesize: options.noSynthesize,
        subtitleMode: options.subtitleMode,
        quality: options.quality,
        style: options.style,
        renderMode: options.renderMode,
        synthesizeLayout: options.synthesizeLayout,
      }),
    );

    await job.start();

    expect(capturedArgs).toEqual(expected);
  });

  it("marks failed with stderr when exit code is non-zero", async () => {
    const run = vi.fn(async (): Promise<VideoCaptionerRunResult> => ({
      exitCode: 1,
      stdout: "",
      stderr: "ERROR: process failed",
    }));
    const { job } = createJob({ videoCaptioner: { run } });

    await job.start();

    expect(job.status).toBe("failed");
    expect(job.toJSON().error).toBe("ERROR: process failed");
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

  it("toJSON omits llm credentials even when translator is llm", async () => {
    const { job } = createJob({
      options: {
        translator: "llm",
        llm: { apiKey: "sk-secret", apiBase: "https://api.example", model: "gpt-4" },
      },
    });

    const snap = job.toJSON();

    expect(snap).not.toHaveProperty("llm");
    expect(JSON.stringify(snap)).not.toContain("sk-secret");
    expect(JSON.stringify(snap)).not.toContain("api.example");
    expect(JSON.stringify(snap)).not.toContain("gpt-4");
  });

  it("passes llm apiKey to VideoCaptionerPort.run args when llm is provided", async () => {
    let capturedArgs: string[] = [];
    const run = vi.fn(async (req: VideoCaptionerRunRequest): Promise<VideoCaptionerRunResult> => {
      capturedArgs = req.args;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job } = createJob({
      videoCaptioner: { run },
      options: {
        translator: "llm",
        llm: { apiKey: "sk-secret", apiBase: "https://api.example", model: "gpt-4" },
      },
    });

    await job.start();

    expect(capturedArgs).toContain("sk-secret");
    expect(capturedArgs).toContain("--api-key");
  });
});
