import { writeFile } from "@/api/writeFile"
import { join } from "@/lib/path"

/** Normalize cookie file text to LF per yt-dlp FAQ. */
export function normalizeYtdlpCookieText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

export function buildYtdlpCookiesFilePath(userDataDir: string, jobId: string): string {
  return join(userDataDir, "temp", `ytdlp-cookies-${jobId}.txt`)
}

export async function writeYtdlpCookiesFile(
  userDataDir: string,
  jobId: string,
  cookieText: string,
): Promise<string> {
  const path = buildYtdlpCookiesFilePath(userDataDir, jobId)
  await writeFile(path, normalizeYtdlpCookieText(cookieText))
  return path
}
