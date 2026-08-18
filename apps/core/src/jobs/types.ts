import type { FolderType } from "@smm/core";

export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "aborted";
export type JobStage = "config" | "metadata" | "listFiles" | "recognize" | "episodes" | "persist" | null;

export interface ImportJob {
  id: string;
  folderPath: string;
  type: FolderType;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  /** Set after the recognize stage when a TV show or movie title is known. */
  recognizedTitle?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
