import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderType } from "@smm/types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import { JobAbortError } from "./jobAbortError";
import type { JobHandle } from "./jobHandle";
import { ImportFolderJob, type ImportFolderJobOptions } from "./ImportFolderJob";
import {
  IMPORT_FOLDER_COMPLETED,
  startedImportFolderMessage,
} from "./importFolderLog";
import { initializeFolder, persistNewFolder } from "../pipeline/importFolderPipeline";
import type { JobLogLevel, JobStatus } from "./types";

vi.mock("../pipeline/importFolderPipeline", () => ({
  persistNewFolder: vi.fn(async () => ({})),
  initializeFolder: vi.fn(async () => {}),
}));

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

function createHandle() {
  const logs: Array<{ level: JobLogLevel; message: string }> = [];
  const updates: Array<Record<string, unknown>> = [];
  const handle: JobHandle = {
    id: "m1abc-0",
    appendLog: vi.fn((level: JobLogLevel, message: string) => {
      logs.push({ level, message });
    }),
    requestStop: vi.fn(),
    throwIfAborted: vi.fn(),
    update: vi.fn((patch) => {
      updates.push(patch as Record<string, unknown>);
    }),
  };
  return { handle, logs, updates };
}

function createJob(
  overrides: Partial<ImportFolderJobOptions> & { files?: Map<string, string> } = {},
) {
  const { fs, files } = createFsMock();
  const logger = createLoggerMock();
  const { handle, logs, updates } = createHandle();
  let status: JobStatus = "pending";
  const job = new ImportFolderJob({
    name: "job-m1abc-0",
    logDir: "/logs",
    join: (...parts: string[]) => parts.join("/"),
    printLogToConsole: false,
    fs,
    logger,
    folderPath: "/media/Show",
    type: "tvshow" satisfies FolderType,
    handle,
    userConfig: {} as ImportFolderJobOptions["userConfig"],
    mediaMetadata: {} as ImportFolderJobOptions["mediaMetadata"],
    recognitionDeps: vi.fn(async () => ({}) as Awaited<ReturnType<ImportFolderJobOptions["recognitionDeps"]>>),
    readStatus: () => status,
    ...overrides,
  });
  return { job, fs, files, logger, handle, logs, updates, setStatus: (next: JobStatus) => { status = next; } };
}

describe("ImportFolderJob", () => {
  beforeEach(() => {
    vi.mocked(persistNewFolder).mockReset();
    vi.mocked(persistNewFolder).mockResolvedValue({} as Awaited<ReturnType<typeof persistNewFolder>>);
    vi.mocked(initializeFolder).mockReset();
    vi.mocked(initializeFolder).mockResolvedValue(undefined);
  });

  it("sets name and logFilePath from options", () => {
    const { job } = createJob({ name: "job-abc", logDir: "/var/log" });
    expect(job.name).toBe("job-abc");
    expect(job.logFilePath).toBe("/var/log/job-abc.log");
  });

  it("persistFolder writes the start line and marks persistFolder", async () => {
    const { job, logs, updates, files, handle } = createJob();

    await expect(job.persistFolder()).resolves.toBe(true);

    expect(vi.mocked(persistNewFolder)).toHaveBeenCalledWith("/media/Show", "tvshow", expect.any(Object));
    expect(logs.map((line) => line.message)).toEqual([
      startedImportFolderMessage("/media/Show", "tvshow"),
    ]);
    expect(updates).toContainEqual({ stage: "persistFolder", progress: 10 });
    expect(files.get(job.logFilePath)).toBe(
      `${startedImportFolderMessage("/media/Show", "tvshow")}\n`,
    );
    expect(handle.appendLog).toHaveBeenCalledWith(
      "info",
      startedImportFolderMessage("/media/Show", "tvshow"),
    );
  });

  it("persistFolder marks the job failed when persisting throws", async () => {
    vi.mocked(persistNewFolder).mockRejectedValue(new Error("disk full"));
    const { job, logs, updates } = createJob();

    await expect(job.persistFolder()).resolves.toBe(false);

    expect(logs.at(-1)).toEqual({ level: "error", message: "disk full" });
    expect(updates.at(-1)).toEqual({ status: "failed", error: "disk full" });
  });

  it("skipRegistration does not persist the folder", async () => {
    const { job } = createJob({ skipRegistration: true });
    await job.persistFolder();
    expect(vi.mocked(persistNewFolder)).not.toHaveBeenCalled();
  });

  it("run appends recognition lines and Completed, then marks succeeded", async () => {
    vi.mocked(initializeFolder).mockImplementation(async (_path, _type, _deps, cb) => {
      await cb?.appendLog?.("info", "Started to recognize folder");
      await cb?.appendLog?.("info", "Recognized folder: My Show");
      cb?.onStage?.("recognizeFolder", 60, { title: "My Show" });
      await cb?.appendLog?.("info", "Started to recognize episodes");
      await cb?.appendLog?.(
        "info",
        "Recognized episode files: 1 files are recognized, didn't recognize files for 1 episodes",
      );
      cb?.onStage?.("recognizeEpisodes", 90);
    });
    const { job, logs, updates, files } = createJob();

    await job.run();

    expect(logs.map((line) => line.message)).toEqual([
      "Started to recognize folder",
      "Recognized folder: My Show",
      "Started to recognize episodes",
      "Recognized episode files: 1 files are recognized, didn't recognize files for 1 episodes",
      IMPORT_FOLDER_COMPLETED,
    ]);
    expect(updates).toContainEqual({
      stage: "recognizeFolder",
      progress: 60,
      recognizedTitle: "My Show",
    });
    expect(updates.at(-1)).toEqual({ status: "succeeded", stage: null, progress: 100 });
    expect(files.get(job.logFilePath)).toBe(
      [
        "Started to recognize folder",
        "Recognized folder: My Show",
        "Started to recognize episodes",
        "Recognized episode files: 1 files are recognized, didn't recognize files for 1 episodes",
        IMPORT_FOLDER_COMPLETED,
        "",
      ].join("\n"),
    );
  });

  it("run logs aborted when recognition is stopped", async () => {
    vi.mocked(initializeFolder).mockImplementation(async (_path, _type, _deps, cb) => {
      cb?.throwIfAborted?.();
    });
    const { job, handle, logs, updates } = createJob();
    vi.mocked(handle.throwIfAborted).mockImplementation(() => {
      throw new JobAbortError("m1abc-0");
    });

    await job.run();

    expect(logs.at(-1)).toEqual({ level: "warn", message: "aborted" });
    expect(updates.at(-1)).toEqual({ status: "aborted", error: "aborted" });
  });

  it("finishSkipInit logs Completed and marks succeeded", async () => {
    const { job, logs, updates } = createJob();
    await job.finishSkipInit();
    expect(logs.map((line) => line.message)).toEqual([IMPORT_FOLDER_COMPLETED]);
    expect(updates.at(-1)).toEqual({ status: "succeeded", progress: 100 });
  });

  it("abort requests stop and status reads the job record", async () => {
    const { job, handle, setStatus } = createJob();
    await job.abort();
    expect(handle.requestStop).toHaveBeenCalledOnce();
    setStatus("running");
    await expect(job.status()).resolves.toBe("running");
  });

  it("skips the log file when logDir is empty", async () => {
    const { job, fs } = createJob({ logDir: "" });
    await job.persistFolder();
    expect(fs.writeTextFile).not.toHaveBeenCalled();
  });
});
