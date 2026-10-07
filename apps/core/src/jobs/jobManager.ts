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

export class JobManager {
  private jobs: Map<string, AbstractJob> = new Map();
  private _queue: PQueue | undefined;
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

  async waitForJobUntilCompleted(id: string): Promise<void> {
    if (this.completedJobs[id] === undefined) {
      throw new Error(`Job not found: ${id}`);
    }
    return await this.completedJobs[id];
  }

  submit(job: AbstractJob, callback: () => void): void {
    this.jobs.set(job.id, job);

    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    this.completedJobs[job.id] = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.queue.add(async () => {
      await withTimeout(async () => {
        try {
          this.ports.logger.info({}, `JobManager started job: type=${job.type} id=${job.id}`);
          await withTimeout(() => job.start(), this.options.timeoutMs);
          resolve();
        } catch (error) {
          this.ports.logger.error({ error }, `Job ${job.id} failed`);
          reject(error);
        } finally {
          this.ports.logger.info({}, `JobManager completed job: type=${job.type} id=${job.id}`);
          callback();
        }
      }, this.options.timeoutMs);
    });
  }

  tryAbort(id: string): void {
    if (this.jobs.has(id)) {
      this.jobs.get(id)?.tryAbort();
    }
  }

  getJob(id: string): AbstractJob | undefined {
    return this.jobs.get(id);
  }
}
