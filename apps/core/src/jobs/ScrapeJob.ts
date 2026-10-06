import type { AppContext, PlatformPorts } from "../types";
import { JobAbortError } from "./jobAbortError";
import { AbstractJob, type JobOptions } from "./abstract-job";
import { initialScrapeTasks, type ScrapeJobSnapshot, type ScrapeJobTask } from "./types";
import type { ScrapeTaskId, ScrapeTaskResult } from "../pipeline/scrape/types";
import {
  runPreparedScrape,
  type PreparedScrape,
} from "../pipeline/scrape/scrapeFolder";

export interface ScrapeJobOptions {
  folderPath: string;
  prepared: PreparedScrape;
}

const TASK_ORDER: ScrapeTaskId[] = ["poster", "fanart", "thumbnails", "nfo"];

/**
 * TMDB/TVDB scrape for one media folder.
 * Log lines are appended to `${logDir}/${id}.log`.
 */
export class ScrapeJob extends AbstractJob {
  readonly folderPath: string;
  private readonly prepared: PreparedScrape;
  private taskState: Record<ScrapeTaskId, ScrapeJobTask> = initialScrapeTasks();
  private failure?: string;
  private readonly createdAt = Date.now();
  private updatedAt = Date.now();

  constructor(
    ctx: AppContext,
    ports: PlatformPorts,
    options: ScrapeJobOptions & Omit<JobOptions, "type">,
  ) {
    super(ctx, ports, {
      ...options,
      type: "scrape",
    });
    this.folderPath = options.folderPath;
    this.prepared = options.prepared;
  }

  get tasks(): Record<ScrapeTaskId, ScrapeJobTask> {
    return this.taskState;
  }

  /** Snapshot consumed by `POST /api/get-job` and the scrape dialog. */
  toJSON(): ScrapeJobSnapshot {
    return {
      kind: "scrape",
      id: this.id,
      folderPath: this.folderPath,
      status: this.status,
      tasks: this.taskState,
      ...(this.failure !== undefined ? { error: this.failure } : {}),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  override async run(): Promise<void> {
    this.setStatus("running");
    this.touch();
    try {
      await this.log(`Started to scrape folder: ${this.folderPath}`);
      if (this.requestToAbort) {
        this.setStatus("aborted");
        this.touch();
        return;
      }

      const result = await runPreparedScrape(this.prepared, this.context, this.ports, {
        onTaskStart: (taskId) => {
          if (this.requestToAbort) {
            throw new JobAbortError();
          }
          this.setTask(taskId, { status: "running" });
        },
        onTaskDone: (taskId, taskResult) => {
          this.setTask(taskId, taskFromResult(taskResult));
          const finished = TASK_ORDER.filter((id) => {
            const status = this.taskState[id].status;
            return status !== "pending" && status !== "running";
          }).length;
          this.setProgress((finished / TASK_ORDER.length) * 100);
        },
      });

      for (const taskId of TASK_ORDER) {
        const taskResult = result.tasks[taskId];
        if (taskResult) this.setTask(taskId, taskFromResult(taskResult));
      }

      const anyFailed = TASK_ORDER.some((id) => this.taskState[id].status === "failed");
      if (anyFailed) {
        this.setStatus("failed");
      }
      // Terminal "succeeded" is set by AbstractJob.start after the lifecycle footer.
      this.touch();
    } catch (error) {
      if (error instanceof JobAbortError) {
        this.setStatus("aborted");
        this.touch();
        await this.log("aborted");
        return;
      }
      this.setStatus("failed");
      const message = error instanceof Error ? error.message : String(error);
      this.failure = message;
      this.touch();
      await this.log(message);
    }
  }

  override async abort(): Promise<void> {}

  private setTask(taskId: ScrapeTaskId, task: ScrapeJobTask): void {
    this.taskState = { ...this.taskState, [taskId]: task };
    this.touch();
  }

  private touch(): void {
    this.updatedAt = Date.now();
  }
}

function taskFromResult(result: ScrapeTaskResult): ScrapeJobTask {
  return {
    status: result.status,
    ...(result.error !== undefined ? { error: result.error } : {}),
  };
}
