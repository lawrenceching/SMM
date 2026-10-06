import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderType } from "@smm/types";
import type { AppContext, PlatformPorts } from "../types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { NetworkPort } from "../ports/NetworkPort";
import { ImportFolderJob, type ImportFolderJobOptions } from "./ImportFolderJob";
import type { JobOptions } from "./abstract-job";
import {
  importJobLogFileName,
  startedImportFolderMessage,
} from "./importFolderLog";
import {
  persistNewFolder,
  recognizeImportedEpisodes,
  recognizeImportedFolder,
} from "../pipeline/importFolderPipeline";

vi.mock("../pipeline/importFolderPipeline", () => ({
  persistNewFolder: vi.fn(async () => ({})),
  recognizeImportedFolder: vi.fn(async () => {}),
  recognizeImportedEpisodes: vi.fn(async () => {}),
}));

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

function createJob(
  overrides: {
    context?: Partial<AppContext>;
    ports?: Partial<PlatformPorts>;
    options?: Partial<ImportFolderJobOptions & JobOptions>;
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

  const options: ImportFolderJobOptions & JobOptions = {
    id: "job-m1abc-0",
    logDir: context.logDir,
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    printLogToConsole: false,
    folderPath: "/media/Show",
    type: "tvshow" satisfies FolderType,
    skipInit: false,
    callbacks: { onLog },
    ...overrides.options,
  };

  const job = new ImportFolderJob(context, ports, options);
  return { job, fs, files, logger, onLog, context, ports };
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

  it("sets id and logFilePath from context.logDir and options.id", () => {
    const { job } = createJob({
      context: { logDir: "/var/log" },
      options: { id: "m1abc-0" },
    });
    expect(job.id).toBe("m1abc-0");
    expect(job.logFilePath).toBe(`/var/log/${importJobLogFileName("m1abc-0")}`);
  });

  it("toJSON reports kind import for get-job polling", () => {
    const { job } = createJob();
    expect(job.toJSON()).toMatchObject({
      kind: "import",
      id: "job-m1abc-0",
      folderPath: "/media/Show",
      type: "import-folder",
      folderType: "tvshow",
    });
  });

  it("persistFolder writes the start line and calls persistNewFolder with ctx/ports", async () => {
    const { job, files, onLog } = createJob();

    await expect(job.persistFolder()).resolves.toBe(true);

    expect(vi.mocked(persistNewFolder)).toHaveBeenCalledWith(
      "/media/Show",
      "tvshow",
      expect.objectContaining({ appDataDir: "/data/smm", userDataDir: "/data/smm" }),
      expect.objectContaining({ fs: expect.anything(), logger: expect.anything() }),
      undefined,
    );
    expect(onLog).toHaveBeenCalledWith(startedImportFolderMessage("/media/Show", "tvshow"));
    expect(files.get(job.logFilePath)).toBe(
      `${startedImportFolderMessage("/media/Show", "tvshow")}\n`,
    );
  });

  it("persistFolder returns false and logs when persisting throws", async () => {
    vi.mocked(persistNewFolder).mockRejectedValue(new Error("disk full"));
    const { job, onLog } = createJob();

    await expect(job.persistFolder()).resolves.toBe(false);

    expect(onLog).toHaveBeenCalledWith("disk full");
  });

  it("run recognizes tvshow folder then episodes and marks succeeded", async () => {
    const { job, onLog } = createJob();

    await job.start();

    expect(persistNewFolder).toHaveBeenCalled();
    expect(recognizeImportedFolder).toHaveBeenCalledWith(
      expect.objectContaining({ folderPath: "/media/Show", filePaths: ["/media/Show/S01E01.mkv"] }),
      expect.anything(),
      expect.anything(),
      undefined,
    );
    expect(recognizeImportedEpisodes).toHaveBeenCalled();
    expect(onLog).toHaveBeenCalledWith(startedImportFolderMessage("/media/Show", "tvshow"));
    expect(onLog).not.toHaveBeenCalledWith("Completed");
    expect(onLog).toHaveBeenCalledWith(`${job.id} completed`);
    expect(job.status).toBe("succeeded");
  });

  it("run for music skips recognition steps", async () => {
    const { job, onLog } = createJob({ options: { type: "music" } });

    await job.start();

    expect(persistNewFolder).toHaveBeenCalled();
    expect(recognizeImportedFolder).not.toHaveBeenCalled();
    expect(recognizeImportedEpisodes).not.toHaveBeenCalled();
    expect(onLog).toHaveBeenCalledWith(startedImportFolderMessage("/media/Show", "music"));
    expect(onLog).not.toHaveBeenCalledWith("Completed");
    expect(onLog).toHaveBeenCalledWith(`${job.id} completed`);
    expect(job.status).toBe("succeeded");
  });

  it("run marks aborted when tryAbort is requested before steps", async () => {
    const { job } = createJob();
    job.tryAbort();

    await job.run();

    expect(job.status).toBe("aborted");
    expect(recognizeImportedFolder).not.toHaveBeenCalled();
  });

  it("writes the log file under context.logDir", async () => {
    const { job, fs } = createJob({ context: { logDir: "/var/log" }, options: { id: "x" } });
    await job.persistFolder();
    expect(fs.writeTextFile).toHaveBeenCalledWith(
      `/var/log/${importJobLogFileName("x")}`,
      expect.any(String),
    );
  });
});
