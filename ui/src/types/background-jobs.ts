/**
 * Background job status type
 */
export type JobStatus = 'pending' | 'running' | 'failed' | 'succeeded' | 'aborted';

/**
 * Background job interface
 * Represents a background job with its current state
 */
export interface BackgroundJob {
  /** Unique identifier for the job */
  id: string;

  /** Human-readable name of the job */
  name: string;

  /** Current status of the job */
  status: JobStatus;

  /** Progress percentage (0-100) */
  progress: number;
}
