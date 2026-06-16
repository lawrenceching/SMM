import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname } from "node:path";
import { Path } from "@smm/core/path";
import { validatePathIsInAllowlist } from "./allowlist.ts";
import type { CoreRoutesConfig } from "./types.ts";

export type DownloadImageContentType = string;

export interface DownloadImageResult {
  buffer: Buffer;
  contentType: DownloadImageContentType;
}

/**
 * Default Content-Type used when the upstream response does not
 * advertise one. Mirrors the original
 * `apps/cli/src/route/DownloadImage.ts` default.
 */
const DEFAULT_CONTENT_TYPE = "image/jpeg";

/**
 * Extension → MIME map for the `file://` branch. Mirrors the
 * original `apps/cli/src/route/DownloadImage.ts:getContentType`.
 */
const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".apng": "image/apng",
};

function getContentTypeFromExtension(ext: string): string {
  return EXTENSION_TO_CONTENT_TYPE[ext.toLowerCase()] ?? DEFAULT_CONTENT_TYPE;
}

/**
 * Normalize a URL:
 *   - "//host/path"  → "https://host/path"
 *   - everything else passes through unchanged.
 *
 * Mirrors the original `apps/cli/src/route/DownloadImage.ts:normalizeUrl`.
 */
function normalizeUrl(url: string): string {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  return url;
}

/**
 * Browser-like request headers used when fetching remote images.
 * Mirrors the original
 * `apps/cli/src/route/DownloadImage.ts:downloadImageFromWeb`.
 */
const REMOTE_IMAGE_REQUEST_HEADERS: Record<string, string> = {
  accept:
    "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "sec-fetch-dest": "image",
  "sec-fetch-mode": "no-cors",
  "sec-fetch-site": "cross-site",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

interface ResolveUrlResult {
  kind: "http" | "file";
  normalizedUrl: string;
  /**
   * Resolved platform path (only set when `kind === "file"`).
   * The caller is responsible for allowlist validation.
   */
  platformPath?: string;
}

/**
 * Validate `url` and decide which branch (`http` / `file`) the
 * `doDownloadImage` core function should take. Mirrors the
 * original `doDownloadImage` URL-routing logic.
 */
/**
 * Inspect a `fetch` failure and surface the underlying cause so
 * the UI can categorize it (timeout vs. DNS vs. connection
 * refused vs. unknown network failure). The returned string
 * preserves the raw cause code and message; the UI is
 * responsible for parsing and localization.
 *
 * Two formats are normalized:
 *   - **Node (undici)** — wraps the underlying socket / DNS /
 *     timeout error in a `TypeError("fetch failed")` and
 *     attaches it via `error.cause` (with `cause.code` and
 *     `cause.message`).
 *   - **Bun** — flattens the cause onto the error itself:
 *     `error.code`, `error.errno`, `error.message`
 *     (e.g. "Unable to connect. Is the computer able to access
 *     the url?" with `code: "ENOTFOUND"`).
 *
 * Without this inspection, callers only see the opaque
 * "fetch failed" (Node) or "Unable to connect" (Bun) message.
 *
 * Examples of the produced string:
 *   - `fetch failed (ETIMEDOUT: Connect Timeout)`     → timeout
 *   - `fetch failed (ENOTFOUND: getaddrinfo ENOTFOUND example.com)` → DNS
 *   - `fetch failed (ECONNREFUSED: connect ECONNREFUSED)` → refused
 *   - `fetch failed (UND_ERR_CONNECT_TIMEOUT)`         → timeout (undici)
 *   - `Unable to connect. Is the computer able to access the url? (ENOTFOUND: getaddrinfo ENOTFOUND example.com)` (Bun)
 *   - `fetch failed` (when `cause` is missing and no code on the error) → fallback
 */
export function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const cause = (error as Error & { cause?: unknown }).cause;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code: unknown }).code)
      : undefined;
  const causeMessage = cause instanceof Error ? cause.message : undefined;

  // Bun flattens the underlying error onto the fetch error itself
  // (no `.cause` wrapper). Inspect `code` / `errno` directly on
  // the error.
  const directCode =
    !causeCode && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined;
  const directErrno =
    !causeCode && typeof error === "object" && "errno" in error
      ? String((error as { errno: unknown }).errno)
      : undefined;

  const code = causeCode ?? directCode ?? directErrno;
  const message = causeMessage;

  const segments: string[] = [];
  if (code) segments.push(code);
  if (message && message !== code) {
    segments.push(message);
  }

  if (segments.length > 0) {
    return `${error.message} (${segments.join(": ")})`;
  }
  return error.message;
}

function resolveUrl(url: string): ResolveUrlResult {
  const normalizedUrl = normalizeUrl(url);

  if (normalizedUrl.startsWith("file://")) {
    const platformPath = fileURLToPath(normalizedUrl);
    return { kind: "file", normalizedUrl, platformPath };
  }

  if (
    normalizedUrl.startsWith("http://") ||
    normalizedUrl.startsWith("https://")
  ) {
    return { kind: "http", normalizedUrl };
  }

  throw new Error(
    `Invalid image URL: ${url}. ` +
      `Must be http://, https://, protocol-relative (//), or file://`,
  );
}

/**
 * Pure function backing `GET /api/image`.
 *
 * Mirrors the original `apps/cli/src/route/DownloadImage.ts:doDownloadImage`
 * behavior, but is framework- and runtime-agnostic:
 *   - "//host/path" is normalized to "https://host/path".
 *   - "file://" URLs are resolved to a platform path; the
 *     resolved POSIX path is checked against `config.allowlist`
 *     (mirrors the cli-internal `allowRead` predicate) before
 *     being read via `node:fs/promises.readFile`.
 *   - "http://" and "https://" URLs are fetched with the same
 *     browser-like headers used by the original implementation.
 *   - The response Content-Type defaults to "image/jpeg" when
 *     missing or unrecognized.
 *
 * The function throws on:
 *   - URL with an unsupported protocol (`ftp://`, `data:`, …).
 *   - `file://` URL pointing outside the allowlist.
 *   - `file://` URL whose platform path fails to read.
 *   - HTTP non-2xx (status is included in the message).
 *   - Network errors from `fetch` (propagated as-is).
 *
 * The route handler (`handleDownloadImageGet`) maps thrown
 * errors to a JSON 500 response.
 */
export async function doDownloadImage(
  url: string,
  config: Pick<CoreRoutesConfig, "allowlist" | "logger" | "fetchImpl">,
): Promise<DownloadImageResult> {

  const { allowlist, logger, fetchImpl = fetch } = config;

  const resolved = resolveUrl(url);
  logger?.info(
    { url: resolved.normalizedUrl, kind: resolved.kind },
    "[DownloadImage] processing request",
  );

  if (resolved.kind === "file") {
    const platformPath = resolved.platformPath!;
    const posixPath = Path.posix(platformPath);
    if (!validatePathIsInAllowlist(posixPath, allowlist)) {
      throw new Error(
        `Permission denied: file ${platformPath} is not allowed to be read`,
      );
    }
    const buffer = await readFile(platformPath);
    const ext = extname(platformPath);
    const contentType = getContentTypeFromExtension(ext);
    logger?.info(
      { platformPath, bytes: buffer.length, contentType },
      "[DownloadImage] read file",
    );
    return { buffer, contentType };
  }

  // resolved.kind === "http"
  let response: Response;
  try {
    response = await fetchImpl(resolved.normalizedUrl, {
      method: "GET",
      headers: REMOTE_IMAGE_REQUEST_HEADERS,
    });
  } catch (error) {
    throw new Error(
      `Failed to download image: ${describeFetchError(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contentType =
    response.headers.get("content-type") ?? DEFAULT_CONTENT_TYPE;
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  logger?.info(
    { url: resolved.normalizedUrl, bytes: buffer.length, contentType },
    "[DownloadImage] fetched remote image",
  );
  return { buffer, contentType };
}
