import { Path } from "@smm/utils/path";

/** Safe job id characters produced by {@link nextJobId} plus underscores. */
const JOB_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isImportJobLogId(jobId: string): boolean {
  return JOB_ID_PATTERN.test(jobId);
}

/** File name under `logDir`: `job-${jobId}.log`. */
export function importJobLogFileName(jobId: string): string {
  return `job-${jobId}.log`;
}

/** POSIX path of the import-folder job log inside `logDir`. */
export function importJobLogPosixPath(logDir: string, jobId: string): string {
  return new Path(Path.posix(logDir)).join(importJobLogFileName(jobId)).abs("posix");
}

export function startedImportFolderMessage(folderPath: string, type: string): string {
  return `Started to import folder: ${folderPath}, type: ${type}`;
}

export const STARTED_RECOGNIZE_FOLDER = "Started to recognize folder";

export function recognizedFolderMessage(title: string): string {
  return `Recognized folder: ${title}`;
}

export const STARTED_RECOGNIZE_EPISODES = "Started to recognize episodes";

export function recognizedEpisodeFilesMessage(
  recognizedFiles: number,
  unrecognizedEpisodes: number,
): string {
  return `Recognized episode files: ${recognizedFiles} files are recognized, didn't recognize files for ${unrecognizedEpisodes} episodes`;
}

export const IMPORT_FOLDER_COMPLETED = "Completed";
