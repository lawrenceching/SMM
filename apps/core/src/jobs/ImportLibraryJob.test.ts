import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderType } from "@smm/types";
import type { AppContext, PlatformPorts } from "../types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type { JobOptions } from "./abstract-job";
import { ImportFolderJob } from "./ImportFolderJob";
import { ImportLibraryJob, type ImportLibraryJobOptions } from "./ImportLibraryJob";

vi.mock("./ImportFolderJob", () => ({
  ImportFolderJob: vi.fn().mockImplementation(function (
    this: { id: string; run: ReturnType<typeof vi.fn> },
    _ctx: unknown,
    _ports: unknown,
    options: { id: string },
  ) {
    this.id = options.id;
    this.run = vi.fn(async () => {});
  }),
}));

function createFsMock(subdirectories: string[] = []) {
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
    exists: vi.fn(async () => true),
    listFiles: vi.fn(async () => []),
    listSubdirectories: vi.fn(async () => subdirectories),
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
    options?: Partial<ImportLibraryJobOptions & JobOptions>;
    subdirectories?: string[];
  } = {},
) {
  const { fs, files } = createFsMock(overrides.subdirectories ?? []);
  const logger = createLoggerMock();
  const network = { fetch: vi.fn() } satisfies NetworkPort;
  const onLog = vi.fn<(message: string) => void>();
  const onMediaMetadataUpdated = vi.fn<(folderPath: string) => void>();

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

  const options: ImportLibraryJobOptions & JobOptions = {
    id: "lib-job-1",
    logDir: context.logDir,
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    printLogToConsole: false,
    libraryPath: "/lib",
    type: "tvshow" satisfies FolderType,
    concurrency: 2,
    skipInit: false,
    onMediaMetadataUpdated,
    callbacks: { onLog },
    ...overrides.options,
  };

  const job = new ImportLibraryJob(context, ports, options);
  return { job, fs, files, logger, onLog, onMediaMetadataUpdated, context, ports, options };
}

describe("ImportLibraryJob", () => {
  beforeEach(() => {
    vi.mocked(ImportFolderJob).mockClear();
  });

  it("sets id and logFilePath from context.logDir and options.id", () => {
    const { job } = createJob({
      context: { logDir: "/var/log" },
      options: { id: "lib-abc" },
    });
    expect(job.id).toBe("lib-abc");
    expect(job.logFilePath).toBe("/var/log/lib-abc.log");
  });

  it("toJSON uses job type import-library, not kind", () => {
    const { job } = createJob({ options: { id: "lib-abc", type: "tvshow" } });
    expect(job.toJSON()).toMatchObject({
      id: "lib-abc",
      type: "import-library",
      folderType: "tvshow",
      libraryPath: "/lib",
      status: "pending",
      tasks: [],
    });
    expect(job.toJSON()).not.toHaveProperty("kind");
  });

  it("toJSON lists a task per subdirectory after run", async () => {
    const { job } = createJob({
      subdirectories: ["/lib/ShowA", "/lib/ShowB"],
    });

    await job.start();

    expect(job.toJSON().tasks).toEqual([
      expect.objectContaining({ path: "/lib/ShowA", status: "succeeded" }),
      expect.objectContaining({ path: "/lib/ShowB", status: "succeeded" }),
    ]);
    expect(job.toJSON().type).toBe("import-library");
    expect(job.status).toBe("succeeded");
  });

  it("run logs the discovered folder count", async () => {
    const { job, onLog, fs } = createJob({
      subdirectories: ["/lib/ShowA", "/lib/ShowB"],
    });

    await job.run();

    expect(fs.listSubdirectories).toHaveBeenCalledWith("/lib");
    expect(onLog).toHaveBeenCalledWith("Found 2 folders to import");
  });

  it("run creates an ImportFolderJob for each subdirectory with forwarded options", async () => {
    const { job, onMediaMetadataUpdated, onLog } = createJob({
      subdirectories: ["/lib/ShowA", "/lib/ShowB"],
      options: { type: "music", skipInit: true },
    });

    await job.run();

    expect(ImportFolderJob).toHaveBeenCalledTimes(2);
    expect(ImportFolderJob).toHaveBeenCalledWith(
      expect.objectContaining({ logDir: "/logs" }),
      expect.objectContaining({ fs: expect.anything() }),
      expect.objectContaining({
        folderPath: "/lib/ShowA",
        type: "music",
        skipInit: true,
        printLogToConsole: false,
        logDir: "/logs",
        onMediaMetadataUpdated,
        callbacks: { onLog },
      }),
    );
    expect(ImportFolderJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ folderPath: "/lib/ShowB" }),
    );

    const firstChild = vi.mocked(ImportFolderJob).mock.results[0]?.value as { run: ReturnType<typeof vi.fn> };
    const secondChild = vi.mocked(ImportFolderJob).mock.results[1]?.value as { run: ReturnType<typeof vi.fn> };
    expect(firstChild.run).toHaveBeenCalledTimes(1);
    expect(secondChild.run).toHaveBeenCalledTimes(1);
  });

  it("run with no subdirectories still logs Found 0 and skips ImportFolderJob", async () => {
    const { job, onLog } = createJob({ subdirectories: [] });

    await job.run();

    expect(onLog).toHaveBeenCalledWith("Found 0 folders to import");
    expect(ImportFolderJob).not.toHaveBeenCalled();
  });

  it("run stops enqueueing more ImportFolderJob children after tryAbort", async () => {
    const { job, logger } = createJob({
      subdirectories: ["/lib/A", "/lib/B", "/lib/C"],
      options: { concurrency: 1 },
    });

    // Mock constructor shape is intentionally incomplete for abort coordination.
    // @ts-expect-error vitest mockImplementation typing vs ImportFolderJob constructor
    vi.mocked(ImportFolderJob).mockImplementation(function (
      this: { id: string; run: ReturnType<typeof vi.fn> },
      _ctx: unknown,
      _ports: unknown,
      options: { id: string },
    ) {
      // Abort after the first child is constructed so later folders are skipped.
      job.tryAbort();
      this.id = options.id;
      this.run = vi.fn(async () => {});
    });

    await job.run();

    expect(ImportFolderJob).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith({}, "Aborted the import-library job");
  });
});
