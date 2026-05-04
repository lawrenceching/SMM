export type ExecuteCmdType = 'ffmpeg' | 'ffprobe' | 'yt-dlp' | 'videocaptioner';

export interface ExecuteCmdRequest {
  command: ExecuteCmdType;
  args: string[];
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

export type ExecuteCmdMessage = ExecuteCmdStdoutStderrMessage | ExecuteCmdSystemMessage;

export interface ExecuteCmdStreamCallbacks {
  onMessage: (message: ExecuteCmdMessage) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
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

      const response = await fetch('/api/executeCmd', {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error ?? `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            const message: ExecuteCmdMessage = JSON.parse(line);
            callbacks.onMessage(message);
          } catch (parseError) {
            console.warn('Failed to parse NDJSON line:', line, parseError);
          }
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
