import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderType } from "@smm/types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { NetworkPort } from "../ports/NetworkPort";
import { JobAbortError } from "./jobAbortError";
import type { JobHandle } from "./jobHandle";
import { ImportFolderJob, type ImportFolderJobOptions } from "./ImportFolderJob";
import {
  IMPORT_FOLDER_COMPLETED,
  startedImportFolderMessage,
} from "./importFolderLog";
import {
  persistNewFolder,
  recognizeImportedEpisodes,
  recognizeImportedFolder,
} from "../pipeline/importFolderPipeline";
import type { JobLogLevel, JobStatus } from "./types";

vi.mock("../pipeline/importFolderPipeline", () => ({
  persistNewFolder: vi.fn(async () => ({})),
  recognizeImportedFolder: vi.fn(async () => {}),
  recognizeImportedEpisodes: vi.fn(async () => {}),
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
    listFiles: vi.fn(async () => ["/media/Show/S01E01.mkv"]),
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
  const network = { fetch: vi.fn() } satisfies NetworkPort;
  const job = new ImportFolderJob({
    id: "job-m1abc-0",
    logDir: "/logs",
    join: (...parts: string[]) => parts.join("/"),
    printLogToConsole: false,
    folderPath: "/media/Show",
    type: "tvshow" satisfies FolderType,
    handle,
    userConfig: {} as ImportFolderJobOptions["userConfig"],
    mediaMetadata: {} as ImportFolderJobOptions["mediaMetadata"],
    context: {
      appDataDir: "/data/smm",
      userDataDir: "/data/smm",
      osLocale: "en-US",
    },
    ports: {
      fs,
      network,
      logger,
      normalizePosix: (path) => path,
    },
    readStatus: () => status,
    ...overrides,
  });
  return { job, fs, files, logger, handle, logs, updates, setStatus: (next: JobStatus) => { status = next; } };
}

describe("ImportFolderJob", () => {
  beforeEach(() => {
    vi.mocked(persistNewFolder).mockReset();
    vi.mocked(persistNewFolder).mockResolvedValue({} as Awaited<ReturnType<typeof persistNewFolder>>);
    vi.mocked(recognizeImportedFolder).mockReset();
    vi.mocked(recognizeImportedFolder).mockResolvedValue(undefined);
    vi.mocked(recognizeImportedEpisodes).mockReset();
    vi.mocked(recognizeImportedEpisodes).mockResolvedValue(undefined);
  });

  it("sets name and logFilePath from options", () => {
    const { job } = createJob({ id: "job-abc", logDir: "/var/log" });
    expect(job.id).toBe("job-abc");
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

    expect(logs.at(-1)).toEqual({ level: "info", message: "disk full" });
    expect(updates.at(-1)).toEqual({ status: "failed", error: "disk full" });
  });

  it("run appends recognition lines and Completed, then marks succeeded", async () => {
    vi.mocked(recognizeImportedFolder).mockImplementation(async (req) => {
      await req.appendLog?.("info", "Started to recognize folder");
      await req.appendLog?.("info", "Recognized folder: My Show");
      req.onStage?.("recognizeFolder", 60, { title: "My Show" });
    });
    vi.mocked(recognizeImportedEpisodes).mockImplementation(async (req) => {
      await req.appendLog?.("info", "Started to recognize episodes");
      await req.appendLog?.(
        "info",
        "Recognized episode files: 1 files are recognized, didn't recognize files for 1 episodes",
      );
      req.onStage?.("recognizeEpisodes", 90);
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

  it("run for music skips recognition steps", async () => {
    const { job, logs, updates } = createJob({ type: "music" });

    await job.run();

    expect(recognizeImportedFolder).not.toHaveBeenCalled();
    expect(recognizeImportedEpisodes).not.toHaveBeenCalled();
    expect(logs.map((line) => line.message)).toEqual([IMPORT_FOLDER_COMPLETED]);
    expect(updates.at(-1)).toEqual({ status: "succeeded", stage: null, progress: 100 });
  });

  it("run logs aborted when recognition is stopped", async () => {
    const { job, handle, logs, updates } = createJob();
    vi.mocked(handle.throwIfAborted).mockImplementation(() => {
      throw new JobAbortError("m1abc-0");
    });

    await job.run();

    expect(logs.at(-1)).toEqual({ level: "info", message: "aborted" });
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
