import { getJobFailed, getJobSucceeded } from "@smm/core/ai-tool/getJobResult";
import { requireNonEmptyString } from "@smm/core/ai-tool/toolResult";
import {
  GET_JOB,
  GET_JOB_DESCRIPTION,
  getJobInputSchema,
  getJobOutputSchema,
  type GetJobOutput,
  type JobToolPayload,
} from "@smm/types/ai-tools/getJob";

export type GetJobRunner = (id: string) => unknown;

/**
 * Load a job by id via host-injected Core runner.
 */
export async function executeGetJob(
  id: string,
  runner: GetJobRunner | undefined,
  abortSignal?: AbortSignal,
): Promise<GetJobOutput> {
  if (abortSignal?.aborted) {
    throw new Error("Request was aborted");
  }

  const idCheck = requireNonEmptyString(id, "id");
  if (typeof idCheck !== "string") {
    return getJobFailed(idCheck.error);
  }

  if (!runner) {
    return getJobFailed("get-job is not available on this host");
  }

  try {
    const job = runner(idCheck);
    if (job == null) {
      return getJobFailed("Error Reason: Job not found");
    }
    return getJobSucceeded(job as JobToolPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const withPrefix = message.startsWith("Error Reason:")
      ? message
      : `Error Reason: ${message}`;
    return getJobFailed(withPrefix);
  }
}

/**
 * Build the AI SDK tool for backend chat (`doChat`).
 */
export function buildGetJobTool(
  runner: GetJobRunner | undefined,
  abortSignal?: AbortSignal,
) {
  return {
    description: GET_JOB_DESCRIPTION,
    inputSchema: getJobInputSchema,
    outputSchema: getJobOutputSchema,
    execute: async (args: unknown): Promise<GetJobOutput> => {
      const params = (args ?? {}) as { id?: string };
      return executeGetJob(params.id ?? "", runner, abortSignal);
    },
  };
}

export { GET_JOB };
