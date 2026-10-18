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
    // Leave status as "running"; AbstractJob.start promotes to succeeded after the footer.
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

  it("tryAbort also calls abort()", async () => {
    const { ports, context } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);
    const job = new QuickJob(context, ports, jobOptions("job-abort-2"));
    const abortSpy = vi.spyOn(job, "abort");
    manager.submit(job, () => {});
    await manager.waitForJobUntilCompleted("job-abort-2");

    manager.tryAbort("job-abort-2");
    expect(abortSpy).toHaveBeenCalledOnce();
  });

  it("listJobs returns submitted jobs", async () => {
    const { ports, context } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);
    const job = new QuickJob(context, ports, jobOptions("job-list-1"));
    manager.submit(job, () => {});
    expect(manager.listJobs()).toEqual([job]);
    await manager.waitForJobUntilCompleted("job-list-1");
  });

  it("ytdlp queue does not block the default queue", async () => {
    const { ports, context } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);

    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });

    class SlowYtdlpJob extends QuickJob {
      override async run(): Promise<void> {
        await slowGate;
      }
    }

    const slow = new SlowYtdlpJob(context, ports, jobOptions("ytdlp-slow"));
    const fast = new QuickJob(context, ports, jobOptions("default-fast"));

    manager.submit(slow, () => {}, { queue: "ytdlp", timeoutMs: 60_000 });
    manager.submit(fast, () => {});

    await manager.waitForJobUntilCompleted("default-fast");
    expect(fast.status).toBe("succeeded");
    expect(slow.status).toBe("running");

    releaseSlow();
    await manager.waitForJobUntilCompleted("ytdlp-slow");
    expect(slow.status).toBe("succeeded");
  });

  it("videocaptioner queue does not block the default queue", async () => {
    const { ports, context } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);

    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });

    class SlowVideocaptionerJob extends QuickJob {
      override async run(): Promise<void> {
        await slowGate;
      }
    }

    const slow = new SlowVideocaptionerJob(context, ports, jobOptions("videocaptioner-slow"));
    const fast = new QuickJob(context, ports, jobOptions("default-fast-vc"));

    manager.submit(slow, () => {}, { queue: "videocaptioner", timeoutMs: 60_000 });
    manager.submit(fast, () => {});

    await manager.waitForJobUntilCompleted("default-fast-vc");
    expect(fast.status).toBe("succeeded");
    expect(slow.status).toBe("running");

    releaseSlow();
    await manager.waitForJobUntilCompleted("videocaptioner-slow");
    expect(slow.status).toBe("succeeded");
  });

  it("ffmpeg queue runs one job at a time", async () => {
    const { ports, context } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    class SlowFfmpegJob extends QuickJob {
      override async run(): Promise<void> {
        await firstGate;
      }
    }

    const first = new SlowFfmpegJob(context, ports, jobOptions("ffmpeg-first"));
    const second = new QuickJob(context, ports, jobOptions("ffmpeg-second"));

    manager.submit(first, () => {}, { queue: "ffmpeg", timeoutMs: 60_000 });
    manager.submit(second, () => {}, { queue: "ffmpeg", timeoutMs: 60_000 });

    await new Promise((r) => setTimeout(r, 50));
    expect(first.status).toBe("running");
    expect(second.status).toBe("pending");

    releaseFirst();
    await manager.waitForJobUntilCompleted("ffmpeg-first");
    await manager.waitForJobUntilCompleted("ffmpeg-second");
    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("succeeded");
  });

  it("videocaptioner queue runs one job at a time", async () => {
    const { ports, context } = createPorts();
    const manager = new JobManager({ concurrency: 1, timeoutMs: 5_000 }, ports);

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    class SlowVideocaptionerJob extends QuickJob {
      override async run(): Promise<void> {
        await firstGate;
      }
    }

    const first = new SlowVideocaptionerJob(context, ports, jobOptions("videocaptioner-first"));
    const second = new QuickJob(context, ports, jobOptions("videocaptioner-second"));

    manager.submit(first, () => {}, { queue: "videocaptioner", timeoutMs: 60_000 });
    manager.submit(second, () => {}, { queue: "videocaptioner", timeoutMs: 60_000 });

    await new Promise((r) => setTimeout(r, 50));
    expect(first.status).toBe("running");
    expect(second.status).toBe("pending");

    releaseFirst();
    await manager.waitForJobUntilCompleted("videocaptioner-first");
    await manager.waitForJobUntilCompleted("videocaptioner-second");
    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("succeeded");
  });
});
