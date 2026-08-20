import type { ImportJob, Job, ScrapeJob } from "./types";

let seq = 0;

/** Runtime-agnostic id: base-36 timestamp + monotonic counter. */
export function nextJobId(): string {
  return `${Date.now().toString(36)}-${(seq++).toString(36)}`;
}

type ImportJobInit = Omit<ImportJob, "id" | "createdAt" | "updatedAt">;
type ScrapeJobInit = Omit<ScrapeJob, "id" | "createdAt" | "updatedAt">;

export class JobStore {
  private readonly jobs = new Map<string, Job>();

  create(init: ImportJobInit): ImportJob;
  create(init: ScrapeJobInit): ScrapeJob;
  create(init: ImportJobInit | ScrapeJobInit): Job {
    const now = Date.now();
    const job = { id: nextJobId(), createdAt: now, updatedAt: now, ...init } as Job;
    this.jobs.set(job.id, job);
    return job;
  }

  update(id: string, patch: Partial<ImportJob> | Partial<ScrapeJob>): void {
    const job = this.jobs.get(id);
    if (job === undefined) return;
    Object.assign(job, patch, { updatedAt: Date.now() });
  }

  get(id: string): Job | undefined {
    const job = this.jobs.get(id);
    return job === undefined ? undefined : structuredClone(job);
  }
}
