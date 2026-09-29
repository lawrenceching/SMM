import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import { DummyJob } from "./DummyJob";
import type { JobOptions } from "./types";

function createFsMock() {
  return {
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(async (_path: string, _content: string) => {}),
    writeBinaryFile: vi.fn(),
    exists: vi.fn(),
    listFiles: vi.fn(),
    listSubdirectories: vi.fn(),
    deleteFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
  } satisfies FsPort;
}

function createLoggerMock() {
  return {
    info: vi.fn<(obj: unknown, msg: string) => void>(),
    warn: vi.fn<(obj: unknown, msg: string) => void>(),
    error: vi.fn<(obj: unknown, msg: string) => void>(),
  } satisfies LoggerPort;
}

function createOptions(overrides: Partial<JobOptions> = {}): JobOptions {
  return {
    name: "dummy",
    logDir: "/logs",
    join: (...parts: string[]) => parts.join("/"),
    printLogToConsole: false,
    fs: createFsMock(),
    logger: createLoggerMock(),
    ...overrides,
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
    const job = new DummyJob(createOptions({ name: "my-dummy", logDir: "/var/log" }));
    expect(job.name).toBe("my-dummy");
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
    const fs = createFsMock();
    const job = new DummyJob(createOptions({ fs }));

    const runPromise = job.run();
    await vi.runAllTimersAsync();
    await runPromise;

    const messages = fs.writeTextFile.mock.calls.map((call) => call[1]);
    expect(messages).toEqual([
      "waiting : 0",
      "waiting : 1",
      "waiting : 2",
      "waiting : 3",
      "waiting : 4",
      "waiting : 5",
      "waiting : 6",
      "waiting : 7",
      "waiting : 8",
      "waiting : 9",
    ]);
    for (const call of fs.writeTextFile.mock.calls) {
      expect(call[0]).toBe("/logs/dummy.log");
    }
  });

  it("start logs started and completed around run", async () => {
    const fs = createFsMock();
    const job = new DummyJob(createOptions({ name: "dummy", fs }));

    const startPromise = job.start();
    await vi.runAllTimersAsync();
    await startPromise;

    const messages = fs.writeTextFile.mock.calls.map((call) => call[1]);
    expect(messages[0]).toBe("dummy started");
    expect(messages.slice(1, 11)).toEqual([
      "waiting : 0",
      "waiting : 1",
      "waiting : 2",
      "waiting : 3",
      "waiting : 4",
      "waiting : 5",
      "waiting : 6",
      "waiting : 7",
      "waiting : 8",
      "waiting : 9",
    ]);
    expect(messages[11]).toBe("dummy completed");
  });

  it("prints log lines to console when printLogToConsole is true", async () => {
    const logger = createLoggerMock();
    const job = new DummyJob(
      createOptions({
        name: "dummy",
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
});
