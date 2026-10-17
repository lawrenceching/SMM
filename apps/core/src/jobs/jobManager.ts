import PQueue from "p-queue";
import type { AbstractJob } from "./abstract-job";
import type { PlatformPorts } from "../types";
import { withTimeout } from "es-toolkit/promise";

let seq = 0;

/** Runtime-agnostic id: base-36 timestamp + monotonic counter. */
export function nextJobId(): string {
  return `${Date.now().toString(36)}-${(seq++).toString(36)}`;
}

interface JobManagerOptions {
  concurrency: number;
  timeoutMs: number;
}

export type JobQueueName = "default" | "ytdlp";

export interface SubmitJobOptions {
  queue?: JobQueueName;
  /** Per-job timeout; defaults to the manager constructor timeout. */
  timeoutMs?: number;
}

export class JobManager {
  private jobs: Map<string, AbstractJob> = new Map();
  private _queue: PQueue | undefined;
  private _ytdlpQueue: PQueue | undefined;
  /**
   * The job id to Promise map.
   * The promise will be resolved when the job is completed.
   */
  private readonly completedJobs: Record<string, Promise<void>> = {};
  private readonly options: JobManagerOptions;
  private readonly ports: PlatformPorts;

  constructor(options: JobManagerOptions, ports: PlatformPorts) {
    this.options = options;
    this.ports = ports;
  }

  private get queue(): PQueue {
    if (this._queue === undefined) {
      this._queue = new PQueue({
        concurrency: this.options.concurrency,
      });
    }
    return this._queue;
  }

  private get ytdlpQueue(): PQueue {
    if (this._ytdlpQueue === undefined) {
      this._ytdlpQueue = new PQueue({
        concurrency: 1,
      });
    }
    return this._ytdlpQueue;
  }

  private queueFor(name: JobQueueName): PQueue {
    return name === "ytdlp" ? this.ytdlpQueue : this.queue;
  }

  async waitForJobUntilCompleted(id: string): Promise<void> {
    if (this.completedJobs[id] === undefined) {
      throw new Error(`Job not found: ${id}`);
    }
    return await this.completedJobs[id];
  }

  submit(job: AbstractJob, callback: () => void, options?: SubmitJobOptions): void {
    this.jobs.set(job.id, job);

    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    this.completedJobs[job.id] = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const queueName = options?.queue ?? "default";
    const timeoutMs = options?.timeoutMs ?? this.options.timeoutMs;
    const targetQueue = this.queueFor(queueName);

    targetQueue.add(async () => {
      await withTimeout(async () => {
        try {
          this.ports.logger.info({}, `JobManager started job: type=${job.type} id=${job.id}`);
          await withTimeout(() => job.start(), timeoutMs);
          resolve();
        } catch (error) {
          this.ports.logger.error({ error }, `Job ${job.id} failed`);
          reject(error);
        } finally {
          this.ports.logger.info({}, `JobManager completed job: type=${job.type} id=${job.id}`);
          callback();
        }
      }, timeoutMs);
    });
  }

  tryAbort(id: string): void {
    const job = this.jobs.get(id);
    if (job === undefined) {
      return;
    }
    job.tryAbort();
    void job.abort();
  }

  getJob(id: string): AbstractJob | undefined {
    return this.jobs.get(id);
  }

  listJobs(): AbstractJob[] {
    return [...this.jobs.values()];
  }
}
