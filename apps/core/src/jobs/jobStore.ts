import type { ImportJob } from "./types";

let seq = 0;

/** Runtime-agnostic id: base-36 timestamp + monotonic counter. */
export function nextJobId(): string {
  return `${Date.now().toString(36)}-${(seq++).toString(36)}`;
}

export class JobStore {
  private readonly jobs = new Map<string, ImportJob>();

  create(init: Omit<ImportJob, "id" | "createdAt" | "updatedAt">): ImportJob {
    const now = Date.now();
    const job: ImportJob = { id: nextJobId(), createdAt: now, updatedAt: now, ...init };
    this.jobs.set(job.id, job);
    return job;
  }

  update(id: string, patch: Partial<ImportJob>): void {
    const job = this.jobs.get(id);
    if (job === undefined) return;
    Object.assign(job, patch, { updatedAt: Date.now() });
  }

  get(id: string): ImportJob | undefined {
    const job = this.jobs.get(id);
    return job === undefined ? undefined : { ...job };
  }
}
