import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppContext, PlatformPorts } from "../types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { NetworkPort } from "../ports/NetworkPort";
import { DummyJob } from "./DummyJob";
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
    listFiles: vi.fn(),
    listSubdirectories: vi.fn(),
    deleteFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
  } satisfies FsPort;
  return { fs, files };
}

function createLoggerMock() {
  return {
    info: vi.fn<(obj: unknown, msg: string) => void>(),
    warn: vi.fn<(obj: unknown, msg: string) => void>(),
    error: vi.fn<(obj: unknown, msg: string) => void>(),
  } satisfies LoggerPort;
}

function createJob(
  overrides: {
    context?: Partial<AppContext>;
    ports?: Partial<PlatformPorts>;
    options?: Partial<Omit<JobOptions, "type"> & { type?: string }>;
  } = {},
) {
  const { fs, files } = createFsMock();
  const logger = createLoggerMock();
  const network = { fetch: vi.fn() } satisfies NetworkPort;
  const onLog = vi.fn<(message: string) => void>();

  const context: AppContext = {
    appDataDir: "/data/smm",
    userDataDir: "/data/smm",
    osLocale: "en-US",
    tmpDir: "/tmp",
    logDir: "/logs",
    ...overrides.context,
  };

  const ports: PlatformPorts = {
    fs,
    network,
    logger,
    normalizePosix: (path) => path,
    ...overrides.ports,
  };

  const options: Omit<JobOptions, "type"> & { type?: string } = {
    id: "dummy",
    logDir: context.logDir,
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    printLogToConsole: false,
    callbacks: { onLog },
    ...overrides.options,
  };

  const job = new DummyJob(context, ports, options);
  return { job, fs, files, logger, onLog, context, ports };
}

describe("DummyJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets id and logFilePath from context.logDir and options.id", () => {
    const { job } = createJob({
      context: { logDir: "/var/log" },
      options: { id: "my-dummy" },
    });
    expect(job.id).toBe("my-dummy");
    expect(job.type).toBe("dummy");
    expect(job.logFilePath).toBe("/var/log/my-dummy.log");
  });

  it("abort throws Method not implemented", () => {
    const { job } = createJob();
    expect(() => job.abort()).toThrow("Method not implemented.");
  });

  it("status starts as pending", () => {
    const { job } = createJob();
    expect(job.status).toBe("pending");
  });

  it("run logs waiting messages for 10 iterations with 1s delay", async () => {
    const { job, fs, files } = createJob();

    const runPromise = job.run();
    await vi.runAllTimersAsync();
    await runPromise;

    expect(files.get("/logs/dummy.log")).toBe(
      Array.from({ length: 10 }, (_, i) => `waiting : ${i}`).join("\n") + "\n",
    );
    for (const call of fs.writeTextFile.mock.calls) {
      expect(call[0]).toBe("/logs/dummy.log");
    }
  });

  it("start logs started and completed around run", async () => {
    const { job, files } = createJob({ options: { id: "dummy" } });

    const startPromise = job.start();
    await vi.runAllTimersAsync();
    await startPromise;

    expect(files.get("/logs/dummy.log")).toBe(
      [
        "dummy started",
        ...Array.from({ length: 10 }, (_, i) => `waiting : ${i}`),
        "dummy completed",
        "",
      ].join("\n"),
    );
  });

  it("prints log lines to console when printLogToConsole is true", async () => {
    const { job, logger } = createJob({
      options: { id: "dummy", printLogToConsole: true },
    });

    const startPromise = job.start();
    await vi.runAllTimersAsync();
    await startPromise;

    expect(logger.info).toHaveBeenCalledWith({}, "[dummy] dummy started");
    expect(logger.info).toHaveBeenCalledWith({}, "[dummy] waiting : 0");
    expect(logger.info).toHaveBeenCalledWith({}, "[dummy] dummy completed");
  });

  it("skips the log file when logDir is empty", async () => {
    const { job, fs } = createJob({ context: { logDir: "" } });

    await job.log("hello");

    expect(fs.writeTextFile).not.toHaveBeenCalled();
  });

  it("warns when writing the log file fails", async () => {
    const { job, fs, logger } = createJob();
    vi.mocked(fs.exists).mockRejectedValue(new Error("disk full"));

    await job.log("hello");

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ name: "dummy" }),
      "job: failed to write job log file",
    );
  });
});
