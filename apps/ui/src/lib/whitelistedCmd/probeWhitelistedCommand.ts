import type { ExecuteCmdType } from "@/api/executeCmd";
import { executeCmdToCompletion } from "./executeCmdToCompletion";

export interface ProbeWhitelistedCommandResult {
  available: boolean;
  error?: string;
}

const PROBE_TIMEOUT_MS = 15_000;

/**
 * Probes tool availability via `executeCmd` and a read-only `--version` invocation.
 */
export async function probeWhitelistedCommand(
  command: ExecuteCmdType
): Promise<ProbeWhitelistedCommandResult> {
  try {
    const result = await executeCmdToCompletion(
      { command, args: ["--version"] },
      { timeoutMs: PROBE_TIMEOUT_MS }
    );
    if (result.success) {
      return { available: true };
    }
    const err = result.error ?? "";
    if (err.includes("not found") || err.includes("404")) {
      return { available: false, error: err };
    }
    return { available: result.exitCode === 0, error: err || undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not found") || msg.includes("404")) {
      return { available: false, error: msg };
    }
    return { available: false, error: msg };
  }
}
