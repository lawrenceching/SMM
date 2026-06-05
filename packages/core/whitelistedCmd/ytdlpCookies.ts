/** Basename prefix for SMM-managed yt-dlp Netscape cookie temp files. */
export const YTDLP_COOKIES_FILENAME_PREFIX = "ytdlp-cookies-";

/** Managed cookies files live under `{userDataDir}/temp/ytdlp-cookies-*.txt`. */
export const YTDLP_COOKIES_FILENAME_PATTERN = /^ytdlp-cookies-.+\.txt$/;

function normalizePathSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

export function parseYtdlpCookiesFileArg(args: string[]): string | undefined {
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === "--cookies") {
      const value = args[i + 1]?.trim();
      if (value) return value;
    }
  }
  return undefined;
}

export function isManagedYtdlpCookiesBasename(basename: string): boolean {
  return YTDLP_COOKIES_FILENAME_PATTERN.test(basename);
}

/**
 * Returns true when `filePath` is an SMM-managed yt-dlp cookies temp file
 * under `{userDataDir}/temp/ytdlp-cookies-*.txt`.
 */
export function isManagedYtdlpCookiesPath(filePath: string, userDataDir: string): boolean {
  const normalizedPath = normalizePathSlashes(filePath);
  const normalizedUserData = normalizePathSlashes(userDataDir).replace(/\/+$/, "");
  const tempPrefix = `${normalizedUserData}/temp/`;
  if (!normalizedPath.startsWith(tempPrefix)) {
    return false;
  }
  const remainder = normalizedPath.slice(tempPrefix.length);
  if (!remainder || remainder.includes("/")) {
    return false;
  }
  return isManagedYtdlpCookiesBasename(remainder);
}

export function buildYtdlpCookiesFilePath(userDataDir: string, jobId: string): string {
  const base = normalizePathSlashes(userDataDir).replace(/\/+$/, "");
  return `${base}/temp/${YTDLP_COOKIES_FILENAME_PREFIX}${jobId}.txt`;
}
