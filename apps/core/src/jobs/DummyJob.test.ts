import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import { DummyJob } from "./DummyJob";
import type { JobOptions } from "./abstract-job";

function createFsMock() {
  const files = new Map<string, string>();
  const fs = {
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

function createOptions(
  overrides: Partial<JobOptions> & {
    files?: Map<string, string>;
    /** Convenience: nested into `ports.fs` when `ports` is not fully overridden. */
    fs?: FsPort;
    /** Convenience: nested into `ports.logger` when `ports` is not fully overridden. */
    logger?: LoggerPort;
  } = {},
): JobOptions & { files?: Map<string, string> } {
  const { fs: defaultFs, files } = createFsMock();
  const defaultLogger = createLoggerMock();
  const {
    files: _ignored,
    fs: overrideFs,
    logger: overrideLogger,
    ports: overridePorts,
    context: overrideContext,
    ...rest
  } = overrides;
  const fs = overrideFs ?? overridePorts?.fs ?? defaultFs;
  const logger = overrideLogger ?? overridePorts?.logger ?? defaultLogger;
  return {
    id: "dummy",
    logDir: "/logs",
    join: (...parts: string[]) => parts.join("/"),
    printLogToConsole: false,
    context: overrideContext ?? {
      appDataDir: "/data/smm",
      userDataDir: "/data/smm",
      osLocale: "en-US",
    },
    ports: {
      network: { fetch: vi.fn() },
      normalizePosix: (path) => path,
      ...overridePorts,
      fs,
      logger,
    },
    ...rest,
    files: overrides.files ?? files,
  };
}

describe("DummyJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets name and logFilePath from options", () => {
    const job = new DummyJob(createOptions({ id: "my-dummy", logDir: "/var/log" }));
    expect(job.id).toBe("my-dummy");
    expect(job.logFilePath).toBe("/var/log/my-dummy.log");
  });

  it("abort throws Method not implemented", () => {
    const job = new DummyJob(createOptions());
    expect(() => job.abort()).toThrow("Method not implemented.");
  });

  it("status throws Method not implemented", () => {
    const job = new DummyJob(createOptions());
    expect(() => job.status()).toThrow("Method not implemented.");
  });

  it("run logs waiting messages for 10 iterations with 1s delay", async () => {
    const { fs, files } = createFsMock();
    const job = new DummyJob(createOptions({ fs }));

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
    const { fs, files } = createFsMock();
    const job = new DummyJob(createOptions({ id: "dummy", fs }));

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
    const logger = createLoggerMock();
    const job = new DummyJob(
      createOptions({
        id: "dummy",
        printLogToConsole: true,
        logger,
      }),
    );

    const startPromise = job.start();
    await vi.runAllTimersAsync();
    await startPromise;

    expect(logger.info).toHaveBeenCalledWith({}, "[dummy] dummy started");
    expect(logger.info).toHaveBeenCalledWith({}, "[dummy] waiting : 0");
    expect(logger.info).toHaveBeenCalledWith({}, "[dummy] dummy completed");
  });

  it("skips the log file when logDir is empty", async () => {
    const { fs } = createFsMock();
    const job = new DummyJob(createOptions({ fs, logDir: "" }));

    await job.log("hello");

    expect(fs.writeTextFile).not.toHaveBeenCalled();
  });

  it("warns when writing the log file fails", async () => {
    const logger = createLoggerMock();
    const { fs } = createFsMock();
    vi.mocked(fs.exists).mockRejectedValue(new Error("disk full"));
    const job = new DummyJob(createOptions({ fs, logger }));

    await job.log("hello");

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ name: "dummy" }),
      "job: failed to write job log file",
    );
  });
});
