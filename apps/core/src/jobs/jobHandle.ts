import type { ImportJob, ImportLibraryJob, JobLogLevel, ScrapeJob } from "./types";

export interface JobHandle {
  readonly id: string;
  appendLog(level: JobLogLevel, message: string): void;
  requestStop(): void;
  throwIfAborted(): void;
  update(patch: Partial<ImportJob> | Partial<ImportLibraryJob> | Partial<ScrapeJob>): void;
}
