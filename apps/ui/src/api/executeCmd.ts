export type ExecuteCmdType = 'ffmpeg' | 'ffprobe' | 'yt-dlp' | 'videocaptioner' | 'qjs';

export interface ExecuteCmdRequest {
  command: ExecuteCmdType;
  args: string[];
  /**
   * Run the command in a pseudo-terminal. Currently honored only for
   * `yt-dlp` (the CLI silently ignores this flag for other commands).
   * Default false. See `.agents/docs/design/executeCmd-pty.md` for
   * context on why yt-dlp needs PTY on Windows.
   */
  tty?: boolean;
}

export interface ExecuteCmdStdoutStderrMessage {
  type: 'stdout' | 'stderr';
  data: string;
}

export interface ExecuteCmdSystemMessage {
  type: 'system';
  data: {
    event: 'exit' | 'error' | 'timeout';
    code?: number | null;
    signal?: string | null;
    message?: string;
  };
}

/**
 * Per-iteration download progress emitted by yt-dlp.
 * Sourced from the CLI's `--progress-template` JSON output.
 */
export interface ExecuteCmdProgressMessage {
  type: 'progress';
  data: {
    /** 0-100 percent. */
    percent: number;
    /** Bytes per second. */
    speed: number;
    /** Estimated seconds remaining; null if unknown. */
    eta: number | null;
    /** Bytes downloaded; null if unknown. */
    downloaded: number | null;
    /** Total bytes; null if unknown. */
    total: number | null;
    status: 'downloading' | 'finished';
  };
}

export type ExecuteCmdMessage =
  | ExecuteCmdStdoutStderrMessage
  | ExecuteCmdSystemMessage
  | ExecuteCmdProgressMessage;

function isTerminalSystemMessage(message: ExecuteCmdMessage): boolean {
  return (
    message.type === 'system' &&
    (message.data.event === 'exit' || message.data.event === 'error' || message.data.event === 'timeout')
  );
}

/** Only Vite dev server (default port 5173) bypasses the /api proxy. Electron uses random CLI port — must stay same-origin. */
function devCliOrigin(): string {
  const raw = import.meta.env.VITE_DEV_CLI_URL;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    const h = window.location.hostname;
    return `http://${h}:30000`;
  }
  return '';
}

export function withDevApiUrl(apiPath: string): string {
  const o = devCliOrigin();
  const p = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return o ? `${o}${p}` : p;
}

export interface ExecuteCmdStreamCallbacks {
  onMessage: (message: ExecuteCmdMessage) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  /** Fired once after a successful response, before NDJSON lines are parsed. */
  onExecutionContext?: (ctx: {
    executionId: string;
    logRelativePath: string | null;
    resolvedExecutablePath: string | null;
  }) => void;
  /** Fired for every `progress` NDJSON message. Optional. */
  onProgress?: (data: ExecuteCmdProgressMessage['data']) => void;
}

export function executeCmdStream(
  request: ExecuteCmdRequest,
  callbacks: ExecuteCmdStreamCallbacks,
  timeoutMs?: number
): AbortController {
  const abortController = new AbortController();

  (async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (timeoutMs) {
        headers['X-Timeout'] = String(timeoutMs);
      }

      const response = await fetch(withDevApiUrl('/api/executeCmd'), {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        // Always prefix the error message with the HTTP status so callers
        // (DVD listing banner, download toast) can classify the failure as
        // a CLI HTTP error and surface the status code to the user. The
        // server's JSON `error` field is appended as additional context.
        const statusPart = `HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ''}`;
        const errorMessage = errorData?.error
          ? `${statusPart}: ${errorData.error}`
          : statusPart;
        throw new Error(errorMessage);
      }

      const executionId = response.headers.get('X-Command-Execution-Id');
      const logRelativePath = response.headers.get('X-Command-Log-Path');
      const resolvedExecutablePath = response.headers.get('X-Resolved-Executable-Path');
      if (callbacks.onExecutionContext && (executionId || resolvedExecutablePath)) {
        callbacks.onExecutionContext({
          executionId: executionId ?? '',
          logRelativePath: logRelativePath?.trim() ? logRelativePath : null,
          resolvedExecutablePath: resolvedExecutablePath?.trim() ? resolvedExecutablePath : null,
        });
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let sawTerminalSystemMessage = false;

      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: !done });
        }

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            const message: ExecuteCmdMessage = JSON.parse(line);
            if (isTerminalSystemMessage(message)) {
              sawTerminalSystemMessage = true;
            }
            if (message.type === 'progress' && callbacks.onProgress) {
              callbacks.onProgress(message.data);
            }
            callbacks.onMessage(message);
          } catch (parseError) {
            console.warn('Failed to parse NDJSON line:', line, parseError);
          }
        }

        if (done) {
          break;
        }

        if (sawTerminalSystemMessage) {
          void reader.cancel('terminal').catch(() => {});
          break;
        }
      }

      if (buffer.trim() !== '') {
        try {
          const message: ExecuteCmdMessage = JSON.parse(buffer);
          callbacks.onMessage(message);
        } catch (parseError) {
          console.warn('Failed to parse NDJSON line:', buffer, parseError);
        }
      }

      callbacks.onComplete();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return abortController;
}
