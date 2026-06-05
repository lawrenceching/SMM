import { writeFile } from '@/api/writeFile';
import { deleteFile } from '@/api/deleteFile';
import {
  buildYtdlpCookiesFilePath,
  isManagedYtdlpCookiesPath,
} from '@core/whitelistedCmd/ytdlpCookies';

/** Normalize cookie file text to LF per yt-dlp FAQ. */
export function normalizeYtdlpCookieText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export { buildYtdlpCookiesFilePath };

export async function writeYtdlpCookiesFile(
  userDataDir: string,
  jobId: string,
  cookieText: string,
): Promise<string> {
  const cookiesPath = buildYtdlpCookiesFilePath(userDataDir, jobId);
  await writeFile(cookiesPath, normalizeYtdlpCookieText(cookieText));
  return cookiesPath;
}

/**
 * Best-effort permanent delete of a managed yt-dlp cookies temp file.
 * Failures are logged on CLI; callers should not surface errors to users.
 */
export async function permanentlyDeleteYtdlpCookiesFile(
  cookiesPath: string,
  userDataDir?: string,
): Promise<void> {
  if (!cookiesPath.trim()) return;
  if (userDataDir && !isManagedYtdlpCookiesPath(cookiesPath, userDataDir)) {
    console.warn('[ytdlpCookies] skip delete: path is not managed', cookiesPath);
    return;
  }
  try {
    await deleteFile(cookiesPath);
  } catch (error) {
    console.warn('[ytdlpCookies] failed to permanently delete cookies file:', error);
  }
}

/** @deprecated Use {@link permanentlyDeleteYtdlpCookiesFile} */
export const deleteYtdlpCookiesFile = permanentlyDeleteYtdlpCookiesFile;
