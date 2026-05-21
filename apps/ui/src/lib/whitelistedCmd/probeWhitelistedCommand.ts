import type { ExecuteCmdType } from "@/api/executeCmd";
import { executeCmdToCompletion } from "./executeCmdToCompletion";

export interface ProbeWhitelistedCommandResult {
  available: boolean;
  /** Absolute path from CLI discovery (`X-Resolved-Executable-Path`), when probe succeeds. */
  resolvedPath?: string;
  error?: string;
}

const PROBE_TIMEOUT_MS = 15_000;

/** ffmpeg/ffprobe use `-version`; other whitelisted tools use `--version`. */
export function versionProbeArgs(command: ExecuteCmdType): string[] {
  return command === "ffmpeg" || command === "ffprobe" ? ["-version"] : ["--version"];
}

/**
 * Probes tool availability via `executeCmd` and a read-only version invocation.
 */
export async function probeWhitelistedCommand(
  command: ExecuteCmdType
): Promise<ProbeWhitelistedCommandResult> {
  const versionArgs = versionProbeArgs(command);
  try {
    const result = await executeCmdToCompletion(
      { command, args: versionArgs },
      { timeoutMs: PROBE_TIMEOUT_MS }
    );
    const available = result.success || result.exitCode === 0;
    if (available) {
      return {
        available: true,
        ...(result.resolvedExecutablePath
          ? { resolvedPath: result.resolvedExecutablePath }
          : {}),
      };
    }
    const err = result.error ?? "";
    if (err.includes("not found") || err.includes("404")) {
      return { available: false, error: err };
    }
    return { available: false, error: err || undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not found") || msg.includes("404")) {
      return { available: false, error: msg };
    }
    return { available: false, error: msg };
  }
}
