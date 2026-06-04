import {
  executeCmdStream,
  type ExecuteCmdMessage,
  type ExecuteCmdProgressMessage,
  type ExecuteCmdRequest,
} from "@/api/executeCmd";

export interface ExecuteCmdCompletionResult {
  success: boolean;
  error?: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionId?: string;
  logRelativePath?: string | null;
  /** Absolute path resolved by CLI `executeCmd` (response header). */
  resolvedExecutablePath?: string | null;
}

/**
 * Per-iteration yt-dlp progress payload surfaced to callers of
 * {@link executeCmdToCompletion} / {@link executeCmdToCompletionWithHeaders}.
 */
export type YtdlpProgressData = ExecuteCmdProgressMessage["data"];

const STDERR_EXCERPT_MAX = 500;

export function truncateStderr(stderr: string, max = STDERR_EXCERPT_MAX): string {
  const trimmed = stderr.trim();
  if (!trimmed) return "";
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

export function formatExecuteCmdFailure(
  command: string,
  exitCode: number | null,
  stderr: string,
  systemMessage?: string
): string {
  if (systemMessage) {
    return systemMessage;
  }
  const suffix = truncateStderr(stderr);
  return suffix
    ? `${command} exited with code ${exitCode ?? "unknown"}: ${suffix}`
    : `${command} exited with code ${exitCode ?? "unknown"}`;
}

export function executeCmdToCompletion(
  request: ExecuteCmdRequest,
  options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
    executionId?: string;
    /** Fired for every `progress` NDJSON message from yt-dlp. */
    onProgress?: (data: YtdlpProgressData) => void;
  }
): Promise<ExecuteCmdCompletionResult> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let exitCode: number | null = null;
    let systemMessage: string | undefined;
    let executionId: string | undefined;
    let logRelativePath: string | null | undefined;
    let resolvedExecutablePath: string | null | undefined;
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const abortController = executeCmdStream(
      request,
      {
        onExecutionContext: (ctx) => {
          executionId = ctx.executionId;
          logRelativePath = ctx.logRelativePath;
          resolvedExecutablePath = ctx.resolvedExecutablePath;
        },
        onMessage: (message: ExecuteCmdMessage) => {
          if (message.type === "stdout") {
            stdout += message.data;
            return;
          }
          if (message.type === "stderr") {
            stderr += message.data;
            return;
          }
          if (message.type === "progress") {
            options?.onProgress?.(message.data);
            return;
          }
          if (message.type !== "system") return;
          const { event, code, message: msg } = message.data;
          if (event === "error") {
            systemMessage = msg ?? "command failed to start";
            return;
          }
          if (event === "timeout") {
            systemMessage = `${request.command} command timed out`;
            return;
          }
          if (event === "exit") {
            exitCode = code ?? null;
          }
        },
        onComplete: () => {
          const success = exitCode === 0 && !systemMessage;
          settle(() =>
            resolve({
              success,
              ...(success
                ? {}
                : { error: formatExecuteCmdFailure(request.command, exitCode, stderr, systemMessage) }),
              stdout,
              stderr,
              exitCode,
              executionId,
              logRelativePath,
              resolvedExecutablePath,
            })
          );
        },
        onError: (err) => {
          settle(() => reject(err));
        },
      },
      options?.timeoutMs
    );

    if (options?.signal) {
      if (options.signal.aborted) {
        abortController.abort();
        return;
      }
      options.signal.addEventListener(
        "abort",
        () => {
          abortController.abort();
        },
        { once: true }
      );
    }

    if (options?.executionId) {
      // Client id is sent via fetch wrapper below when using executeCmdViaFetch in SW;
      // main-thread callers pass executionId through executeCmdWithOptionalId when added.
      void options.executionId;
    }
  });
}

/**
 * Same as {@link executeCmdToCompletion} but allows optional `X-Command-Execution-Id` header.
 */
export async function executeCmdToCompletionWithHeaders(
  request: ExecuteCmdRequest,
  options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
    executionId?: string;
    /** Fired for every `progress` NDJSON message from yt-dlp. */
    onProgress?: (data: YtdlpProgressData) => void;
  }
): Promise<ExecuteCmdCompletionResult> {
  if (!options?.executionId) {
    return executeCmdToCompletion(request, options);
  }

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let exitCode: number | null = null;
    let systemMessage: string | undefined;
    let executionId: string | undefined = options.executionId;
    let logRelativePath: string | null | undefined;
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    void (async () => {
      try {
        const { withDevApiUrl } = await import("@/api/executeCmd");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Command-Execution-Id": options.executionId!,
        };
        if (options.timeoutMs) {
          headers["X-Timeout"] = String(options.timeoutMs);
        }

        const response = await fetch(withDevApiUrl("/api/executeCmd"), {
          method: "POST",
          headers,
          body: JSON.stringify(request),
          signal: options.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error ?? `HTTP ${response.status}`);
        }

        const hdrId = response.headers.get("X-Command-Execution-Id");
        const hdrLog = response.headers.get("X-Command-Log-Path");
        const hdrResolved = response.headers.get("X-Resolved-Executable-Path");
        if (hdrId) executionId = hdrId;
        logRelativePath = hdrLog?.trim() ? hdrLog : null;
        const resolvedExecutablePath = hdrResolved?.trim() ? hdrResolved : null;

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
          }
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const message = JSON.parse(line) as ExecuteCmdMessage;
              if (message.type === "stdout") stdout += message.data;
              else if (message.type === "stderr") stderr += message.data;
              else if (message.type === "progress") {
                options?.onProgress?.(message.data);
              } else if (message.type === "system") {
                const { event, code, message: msg } = message.data;
                if (event === "error") systemMessage = msg ?? "command failed";
                else if (event === "timeout") systemMessage = `${request.command} timed out`;
                else if (event === "exit") exitCode = code ?? null;
              }
            } catch {
              /* ignore parse errors */
            }
          }
          if (done) break;
        }

        const success = exitCode === 0 && !systemMessage;
        settle(() =>
          resolve({
            success,
            ...(success
              ? {}
              : { error: formatExecuteCmdFailure(request.command, exitCode, stderr, systemMessage) }),
            stdout,
            stderr,
            exitCode,
            executionId,
            logRelativePath,
            resolvedExecutablePath,
          })
        );
      } catch (e) {
        settle(() => reject(e instanceof Error ? e : new Error(String(e))));
      }
    })();
  });
}
