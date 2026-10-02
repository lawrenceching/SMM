import { describe, expect, it, vi } from "vitest";
import type { AppContext, PlatformPorts } from "../types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { NetworkPort } from "../ports/NetworkPort";
import { AbstractJob, type JobOptions } from "./abstract-job";
import { JobManager } from "./jobManager";

class QuickJob extends AbstractJob {
  constructor(ctx: AppContext, ports: PlatformPorts, options: JobOptions) {
    super(ctx, ports, options);
  }

  async run(): Promise<void> {
    this.setStatus("succeeded");
  }

  abort(): Promise<void> {
    return Promise.resolve();
  }
}

function createPorts() {
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
    deleteFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
  } satisfies FsPort;
  const logger = {
    info: vi.fn<(obj: unknown, msg: string) => void>(),
    warn: vi.fn<(obj: unknown, msg: string) => void>(),
    error: vi.fn<(obj: unknown, msg: string) => void>(),
  } satisfies LoggerPort;
  const network = { fetch: vi.fn() } satisfies NetworkPort;
  const ports: PlatformPorts = {
    fs,
    network,
    logger,
    normalizePosix: (path) => path,
  };
  const context: AppContext = {
    appDataDir: "/data/smm",
    userDataDir: "/data/smm",
    osLocale: "en-US",
    tmpDir: "/tmp",
    logDir: "/logs",
  };
  return { ports, context, logger };
}

function jobOptions(id: string): JobOptions {
  return {
    id,
    type: "dummy",
    logDir: "/logs",
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    printLogToConsole: false,
    callbacks: {},
  };
}

describe("JobManager", () => {
  it("submit stores the job and getJob returns it", async () => {
    const { ports, context } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);
    const job = new QuickJob(context, ports, jobOptions("job-1"));
    const callback = vi.fn();

    manager.submit(job, callback);
    expect(manager.getJob("job-1")).toBe(job);

    await manager.waitForJobUntilCompleted("job-1");
    expect(job.status).toBe("succeeded");
    expect(callback).toHaveBeenCalledOnce();
  });

  it("getJob returns undefined for unknown id", () => {
    const { ports } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);
    expect(manager.getJob("missing")).toBeUndefined();
  });

  it("waitForJobUntilCompleted throws when job was never submitted", async () => {
    const { ports } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);
    await expect(manager.waitForJobUntilCompleted("missing")).rejects.toThrow("Job not found: missing");
  });

  it("tryAbort forwards to the stored job", async () => {
    const { ports, context } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);
    const job = new QuickJob(context, ports, jobOptions("job-abort"));
    const tryAbortSpy = vi.spyOn(job, "tryAbort");
    manager.submit(job, () => {});
    await manager.waitForJobUntilCompleted("job-abort");

    manager.tryAbort("job-abort");
    expect(tryAbortSpy).toHaveBeenCalledOnce();
  });

  it("tryAbort on unknown id is a no-op", () => {
    const { ports } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);
    expect(() => manager.tryAbort("missing")).not.toThrow();
  });
});
