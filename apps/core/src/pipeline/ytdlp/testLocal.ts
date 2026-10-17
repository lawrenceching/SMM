const HTTP_STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  407: "Proxy Authentication Required",
  412: "Precondition Failed",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/** Fixed video ID used in all test URL simulations. */
const TEST_VIDEO_ID = "1fSV26aE5Q";

/**
 * Parses `https://test.local/{extractor}/http/{status_code}`.
 * Returns null when the URL is not a valid test URL.
 */
export function parseTestYtDlpUrl(url: string): { extractor: string; statusCode: number } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.host !== "test.local") {
      return null;
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length !== 3) return null;
    if (parts[1] !== "http") return null;
    const statusCodeRaw = parts[2];
    if (statusCodeRaw === undefined) return null;
    const statusCode = Number.parseInt(statusCodeRaw, 10);
    if (Number.isNaN(statusCode) || statusCode < 100 || statusCode > 999) return null;
    const extractor = parts[0];
    if (extractor === undefined) return null;
    return { extractor, statusCode };
  } catch {
    return null;
  }
}

export function isTestYtDlpUrl(args: string[]): boolean {
  return args.some((arg) => arg.startsWith("https://test.local"));
}

export function extractTestYtDlpUrl(args: string[]): string | null {
  return args.find((arg) => arg.startsWith("https://test.local")) ?? null;
}

function capitalizeExtractorName(extractor: string): string {
  const knownNames: Record<string, string> = {
    bilibili: "BiliBili",
    youtube: "YouTube",
    niconico: "Niconico",
  };
  const known = knownNames[extractor.toLowerCase()];
  if (known !== undefined) {
    return known;
  }
  return extractor.charAt(0).toUpperCase() + extractor.slice(1);
}

/** Simulated yt-dlp stderr for a valid test.local URL. */
export function buildYtDlpSimulatedError(testUrl: string): string {
  const parsed = parseTestYtDlpUrl(testUrl);
  if (!parsed) {
    return `ERROR: Unable to download webpage: test URL parse failed`;
  }
  const { extractor, statusCode } = parsed;
  const statusText = HTTP_STATUS_TEXT[statusCode] ?? "Unknown Error";
  const extractorDisplay = capitalizeExtractorName(extractor);
  return `ERROR: [${extractorDisplay}] ${TEST_VIDEO_ID}: Unable to download webpage: HTTP Error ${statusCode}: ${statusText} (caused by <HTTPError ${statusCode}: ${statusText}>)`;
}
