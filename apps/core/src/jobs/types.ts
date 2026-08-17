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
  error?: string;
  createdAt: number;
  updatedAt: number;
}
