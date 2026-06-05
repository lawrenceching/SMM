import {
  parseYtdlpCookiesFileArg,
  isManagedYtdlpCookiesPath,
} from '@core/whitelistedCmd/ytdlpCookies';
import {
  executeCmdToCompletion,
  executeCmdToCompletionWithHeaders,
  type ExecuteCmdCompletionResult,
  type YtdlpProgressData,
} from '@/lib/whitelistedCmd/executeCmdToCompletion';
import { permanentlyDeleteYtdlpCookiesFile } from '@/lib/ytdlpCookiesFile';

export type YtdlpCleanupPolicy =
  /** Delete managed cookies file after this command completes (success or failure). */
  | 'managed-cookies-after-run'
  /** Caller is responsible (e.g. batch download job finally block). */
  | 'none';

export interface ExecuteYtdlpOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  executionId?: string;
  tty?: boolean;
  onProgress?: (data: YtdlpProgressData) => void;
  cleanup?: YtdlpCleanupPolicy;
  /** Required when cleanup is `managed-cookies-after-run` (client-side path guard). */
  userDataDir?: string;
}

async function maybeCleanupManagedCookies(
  args: string[],
  cleanup: YtdlpCleanupPolicy | undefined,
  userDataDir: string | undefined,
): Promise<void> {
  if (cleanup !== 'managed-cookies-after-run') return;
  const cookiesPath = parseYtdlpCookiesFileArg(args);
  if (!cookiesPath) return;
  await permanentlyDeleteYtdlpCookiesFile(cookiesPath, userDataDir);
}

/**
 * Single entry point for UI yt-dlp executeCmd invocations.
 * Use `cleanup: 'managed-cookies-after-run'` for one-shot commands (e.g. list formats).
 */
export async function executeYtdlp(
  args: string[],
  options: ExecuteYtdlpOptions = {},
): Promise<ExecuteCmdCompletionResult> {
  const request = { command: 'yt-dlp' as const, args, tty: options.tty };
  const execOptions = {
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    executionId: options.executionId,
    onProgress: options.onProgress,
  };

  try {
    if (options.executionId) {
      return await executeCmdToCompletionWithHeaders(request, {
        ...execOptions,
        executionId: options.executionId,
      });
    }
    return await executeCmdToCompletion(request, execOptions);
  } finally {
    await maybeCleanupManagedCookies(args, options.cleanup, options.userDataDir);
  }
}

export { isManagedYtdlpCookiesPath, parseYtdlpCookiesFileArg };
