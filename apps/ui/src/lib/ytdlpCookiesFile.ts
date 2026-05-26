import { writeFile } from "@/api/writeFile"
import { deleteFile } from "@/api/deleteFile"
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

export async function deleteYtdlpCookiesFile(path: string): Promise<void> {
  try {
    await deleteFile(path)
  } catch {
    // Best-effort cleanup; don't surface errors to the user
  }
}
