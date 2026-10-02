import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppContext, PlatformPorts } from "../types";
import type { FsPort } from "../ports/FsPort";
import type { LoggerPort } from "../ports/LoggerPort";
import type { NetworkPort } from "../ports/NetworkPort";
import type { JobOptions } from "./abstract-job";
import { ScrapeJob, type ScrapeJobOptions } from "./ScrapeJob";
import { runPreparedScrape, type PreparedScrape } from "../pipeline/scrape/scrapeFolder";
import type { ScrapeFolderResult } from "../pipeline/scrape/types";

vi.mock("../pipeline/scrape/scrapeFolder", async () => {
  const actual = await vi.importActual<typeof import("../pipeline/scrape/scrapeFolder")>(
    "../pipeline/scrape/scrapeFolder",
  );
  return {
    ...actual,
    runPreparedScrape: vi.fn(),
  };
});

const completedResult: ScrapeFolderResult = {
  mediaFolderPath: "/media/Show",
  tasks: {
    poster: { status: "completed" },
    fanart: { status: "skipped" },
    thumbnails: { status: "completed" },
    nfo: { status: "completed" },
  },
};

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
    options?: Partial<ScrapeJobOptions & Omit<JobOptions, "type">>;
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

  const prepared = {
    posixPath: "/media/Show",
    language: "en-US",
    config: {},
    mediaMetadata: { mediaFolderPath: "/media/Show", type: "tvshow-folder" },
  } as PreparedScrape;

  const options: ScrapeJobOptions & Omit<JobOptions, "type"> = {
    id: "job-scrape-1",
    logDir: context.logDir,
    join: (...parts: string[]) => parts.filter(Boolean).join("/"),
    printLogToConsole: false,
    folderPath: "/media/Show",
    prepared,
    callbacks: { onLog },
    ...overrides.options,
  };

  const job = new ScrapeJob(context, ports, options);
  return { job, fs, files, logger, onLog, prepared, context, ports };
}

describe("ScrapeJob", () => {
  beforeEach(() => {
    vi.mocked(runPreparedScrape).mockReset();
    vi.mocked(runPreparedScrape).mockImplementation(async (_prepared, _context, _ports, progress) => {
      progress?.onTaskStart?.("poster");
      progress?.onTaskDone?.("poster", { status: "completed" });
      progress?.onTaskDone?.("fanart", { status: "skipped" });
      progress?.onTaskStart?.("thumbnails");
      progress?.onTaskDone?.("thumbnails", { status: "completed" });
      progress?.onTaskStart?.("nfo");
      progress?.onTaskDone?.("nfo", { status: "completed" });
      return completedResult;
    });
  });

  it("sets id, type, and logFilePath from context.logDir and options.id", () => {
    const { job } = createJob({
      context: { logDir: "/var/log" },
      options: { id: "job-abc" },
    });
    expect(job.id).toBe("job-abc");
    expect(job.type).toBe("scrape");
    expect(job.logFilePath).toBe("/var/log/job-abc.log");
    expect(job.folderPath).toBe("/media/Show");
  });

  it("run records task statuses and marks succeeded when no task fails", async () => {
    const { job, onLog, prepared, context, ports } = createJob();
    let posterWhileRunning: string | undefined;
    vi.mocked(runPreparedScrape).mockImplementation(async (_prepared, _context, _ports, progress) => {
      progress?.onTaskStart?.("poster");
      posterWhileRunning = job.tasks.poster.status;
      progress?.onTaskDone?.("poster", { status: "completed" });
      progress?.onTaskDone?.("fanart", { status: "skipped" });
      progress?.onTaskDone?.("thumbnails", { status: "completed" });
      progress?.onTaskDone?.("nfo", { status: "completed" });
      return completedResult;
    });

    await job.run();

    expect(runPreparedScrape).toHaveBeenCalledWith(prepared, context, ports, expect.any(Object));
    expect(posterWhileRunning).toBe("running");
    expect(job.tasks.poster).toEqual({ status: "completed" });
    expect(job.tasks.fanart).toEqual({ status: "skipped" });
    expect(job.tasks.nfo).toEqual({ status: "completed" });
    expect(job.status).toBe("succeeded");
    expect(onLog).toHaveBeenCalledWith(expect.stringContaining("/media/Show"));
    expect(job.toJSON()).toMatchObject({
      kind: "scrape",
      id: job.id,
      folderPath: "/media/Show",
      status: "succeeded",
      tasks: {
        poster: { status: "completed" },
        fanart: { status: "skipped" },
      },
    });
  });

  it("run marks failed when a scrape task fails", async () => {
    vi.mocked(runPreparedScrape).mockResolvedValue({
      mediaFolderPath: "/media/Show",
      tasks: {
        poster: { status: "failed", error: "network" },
        fanart: { status: "completed" },
        thumbnails: { status: "completed" },
        nfo: { status: "skipped" },
      },
    });
    const { job } = createJob();

    await job.run();

    expect(job.status).toBe("failed");
    expect(job.tasks.poster).toEqual({ status: "failed", error: "network" });
  });

  it("run marks aborted when tryAbort is requested before scrape starts", async () => {
    const { job } = createJob();
    job.tryAbort();

    await job.run();

    expect(job.status).toBe("aborted");
    expect(runPreparedScrape).not.toHaveBeenCalled();
  });

  it("run marks failed and logs when scrape throws", async () => {
    vi.mocked(runPreparedScrape).mockRejectedValue(new Error("disk full"));
    const { job, onLog } = createJob();

    await job.run();

    expect(job.status).toBe("failed");
    expect(onLog).toHaveBeenCalledWith("disk full");
  });
});
