import { describe, expect, it, vi } from "vitest";
import type { AppContext, PlatformPorts } from "../types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type { CommandPort, CommandRunRequest, CommandRunResult } from "../ports/CommandPort";
import { buildYtdlpCookiesFilePath } from "../whitelistedCmd/ytdlpCookies";
import { YtdlpJob, type YtdlpJobOptions } from "./YtdlpJob";
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
  command?: CommandPort;
  cookiesText?: string;
  url?: string;
} = {}) {
  const { fs, files } = createFsMock();
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } satisfies LoggerPort;
  const network = { fetch: vi.fn() } satisfies NetworkPort;
  const command: CommandPort = overrides.command ?? {
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
    command,
  };
  const options: YtdlpJobOptions & Omit<JobOptions, "type"> = {
    id: "yt-1",
    logDir: context.logDir,
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    printLogToConsole: false,
    callbacks: {},
    url: overrides.url ?? "https://www.bilibili.com/video/BV1",
    folder: "/downloads",
    title: "Demo",
    cookiesText: overrides.cookiesText,
  };

  const job = new YtdlpJob(context, ports, options);
  return { job, fs, files, command, ports, context };
}

describe("YtdlpJob", () => {
  it("downloads one URL and becomes succeeded", async () => {
    const run = vi.fn(async (): Promise<CommandRunResult> => ({
      exitCode: 0,
      stdout:
        '{"percent": "100%", "speed": "0", "eta": "0", "downloaded": "1", "total": "1", "status": "finished"}\n',
      stderr: "",
    }));
    const { job } = createJob({ command: { run } });

    await job.start();

    expect(run).toHaveBeenCalledOnce();
    expect(job.status).toBe("succeeded");
    const snap = job.toJSON();
    expect(snap.kind).toBe("ytdlp");
    expect(snap.url).toContain("bilibili");
    expect(snap.progress).toBe(100);
  });

  it("marks failed with errorType when exit code is non-zero", async () => {
    const run = vi.fn(async (): Promise<CommandRunResult> => ({
      exitCode: 1,
      stdout: "",
      stderr: "ERROR: Unsupported URL: https://mock.invalid/video",
    }));
    const { job } = createJob({ command: { run } });

    await job.start();

    expect(job.status).toBe("failed");
    expect(job.toJSON().errorType).toBe("unsupported-url");
  });

  it("writes and deletes managed cookies file", async () => {
    let capturedArgs: string[] = [];
    const run = vi.fn(async (req: CommandRunRequest): Promise<CommandRunResult> => {
      capturedArgs = req.args;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job, files } = createJob({
      command: { run },
      cookiesText: "# Netscape\n.example.com\tTRUE\t/\tFALSE\t0\tname\tvalue\n",
    });
    const cookiesPath = buildYtdlpCookiesFilePath("/data/smm", "yt-1");

    await job.start();

    expect(run).toHaveBeenCalledOnce();
    expect(capturedArgs).toContain("--cookies");
    expect(capturedArgs).toContain(cookiesPath);
    expect(files.has(cookiesPath)).toBe(false);
  });

  it("updates progress from stdout progress lines", async () => {
    let midwayProgress = -1;
    let midwaySpeed = -1;
    let jobRef: YtdlpJob | undefined;
    const run = vi.fn(async (req: CommandRunRequest): Promise<CommandRunResult> => {
      req.onStdoutLine?.(
        '{"percent": "25%", "speed": "2048", "eta": "40", "downloaded": "25", "total": "100", "status": "downloading"}',
      );
      midwayProgress = jobRef!.progress();
      midwaySpeed = jobRef!.toJSON().speedBps ?? -1;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const { job } = createJob({ command: { run } });
    jobRef = job;

    await job.start();

    expect(midwayProgress).toBe(25);
    expect(midwaySpeed).toBe(2048);
    expect(job.toJSON().progress).toBe(100);
  });

  it("aborts in-flight command when abort() is called", async () => {
    let seenSignal: AbortSignal | undefined;
    let releaseRun!: () => void;
    const runEntered = new Promise<void>((resolve) => {
      releaseRun = resolve;
    });
    const run = vi.fn(async (_req: CommandRunRequest, signal: AbortSignal): Promise<CommandRunResult> => {
      seenSignal = signal;
      releaseRun();
      await new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => resolve(), { once: true });
      });
      const err = new Error("aborted");
      (err as Error & { name: string }).name = "AbortError";
      throw err;
    });
    const { job } = createJob({ command: { run } });

    const started = job.start();
    await runEntered;
    await job.abort();
    await started;

    expect(seenSignal?.aborted).toBe(true);
    expect(job.status).toBe("aborted");
  });

  it("simulates test.local without calling CommandPort", async () => {
    const run = vi.fn();
    const { job } = createJob({
      command: { run },
      url: "https://test.local/bilibili/http/412",
    });

    await job.start();

    expect(run).not.toHaveBeenCalled();
    expect(job.status).toBe("failed");
    expect(job.toJSON().errorType).toBe("http-412");
  });
});
