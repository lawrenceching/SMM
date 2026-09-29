import PQueue from "p-queue";
import { JobAbortError } from "./jobAbortError";
import type { JobHandle } from "./jobHandle";
import type {
  AbstractJob,
  ImportJob,
  ImportLibraryJob,
  Job,
  JobLogLevel,
  JobLogLine,
  JobStatus,
  ScrapeJob,
} from "./types";
import type { LoggerPort } from "src/ports/LoggerPort";
import type { PlatformPorts } from "src/types";

let seq = 0;

/** Runtime-agnostic id: base-36 timestamp + monotonic counter. */
export function nextJobId(): string {
  return `${Date.now().toString(36)}-${(seq++).toString(36)}`;
}

type ImportJobInit = Omit<ImportJob, "id" | "createdAt" | "updatedAt">;
type ImportLibraryJobInit = Omit<ImportLibraryJob, "id" | "createdAt" | "updatedAt">;
type ScrapeJobInit = Omit<ScrapeJob, "id" | "createdAt" | "updatedAt">;
type JobInit = ImportJobInit | ImportLibraryJobInit | ScrapeJobInit;
type JobPatch = Partial<ImportJob> | Partial<ImportLibraryJob> | Partial<ScrapeJob>;

function isTerminal(status: JobStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "aborted";
}

interface JobRecord {
  job: Job;
  logs: JobLogLine[];
  abortRequested: boolean;
}

class JobHandleImpl implements JobHandle {
  constructor(
    readonly id: string,
    private readonly manager: JobManager,
  ) {}


  appendLog(level: JobLogLevel, message: string): void {
    this.manager.appendLog(this.id, level, message);
  }

  requestStop(): void {
    this.manager.requestStop(this.id);
  }

  throwIfAborted(): void {
    this.manager.throwIfAborted(this.id);
  }

  update(patch: JobPatch): void {
    this.manager.update(this.id, patch);
  }
}

interface JobManagerOptions {
  concurrency: number;
}

export class JobManager {
  private readonly records = new Map<string, JobRecord>();

  private jobs: Map<string, AbstractJob> = new Map();
  private _queue: PQueue;
  /**
   * The job id to Promise map
   * The promise will be resolved when the job is completed
   */
  private readonly completedJobs: Record<string, Promise<void>> = {};

  constructor(
    private readonly options: JobManagerOptions,
    private readonly ports: PlatformPorts
  ) {
  }


  private get queue(): PQueue {
    if(this._queue === undefined) {
      this._queue = new PQueue({
        concurrency: this.options.concurrency,
      });
    }
    return this._queue;
  }

  async waitForJobUntilCompleted(id: string): Promise<void> {
    if(this.completedJobs[id] === undefined) {
      throw new Error(`Job not found: ${id}`);
    }
    return await this.completedJobs[id];
  }

  /**
   * 
   * @param job 
   */
  submit(job: AbstractJob, callback: () => void): void {

    this.jobs.set(job.id, job);

    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    this.completedJobs[job.id] = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  
    this.queue.add(async () => {
      try {
        this.ports.logger.info({}, `JobManager started job: type=${job.type} id=${job.id}`);
        await job.start();
        resolve();
      } catch(error) {
        this.ports.logger.error({ error }, `Job ${job.id} failed`);
        reject(error);
      } finally {
        this.ports.logger.info({}, `JobManager completed job: type=${job.type} id=${job.id}`);
        callback();
      }
      
    })
    
  }

  create(init: ImportJobInit): JobHandle;
  create(init: ImportLibraryJobInit): JobHandle;
  create(init: ScrapeJobInit): JobHandle;
  create(init: JobInit): JobHandle {
    const now = Date.now();
    const job = { id: nextJobId(), createdAt: now, updatedAt: now, ...init } as Job;
    this.records.set(job.id, { job, logs: [], abortRequested: false });
    return new JobHandleImpl(job.id, this);
  }

  update(id: string, patch: JobPatch): void {
    const record = this.records.get(id);
    if (record === undefined) return;
    if (isTerminal(record.job.status)) return;
    Object.assign(record.job, patch, { updatedAt: Date.now() });
  }

  get(id: string): Job | undefined {
    const record = this.records.get(id);
    return record === undefined ? undefined : structuredClone(record.job);
  }

  getLog(id: string): JobLogLine[] | undefined {
    const record = this.records.get(id);
    return record === undefined ? undefined : structuredClone(record.logs);
  }

  appendLog(id: string, level: JobLogLevel, message: string): void {
    const record = this.records.get(id);
    if (record === undefined) return;
    if (isTerminal(record.job.status)) return;
    record.logs.push({ ts: Date.now(), level, message });
    record.job.updatedAt = Date.now();
  }

  requestStop(id: string): void {
    const record = this.records.get(id);
    if (record === undefined) return;
    record.abortRequested = true;
    record.job.updatedAt = Date.now();
  }

  throwIfAborted(id: string): void {
    const record = this.records.get(id);
    if (record?.abortRequested === true) {
      throw new JobAbortError();
    }
  }
}
