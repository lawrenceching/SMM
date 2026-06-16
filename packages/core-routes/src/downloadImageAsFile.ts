import { Buffer } from "node:buffer";
import { writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { z } from "zod/v3";
import { Path } from "@smm/core/path";
import { existedFileError } from "@smm/core/errors";
import type {
  DownloadImageRequestBody,
  DownloadImageResponseBody,
} from "@smm/core/types";
import { validatePathIsInAllowlist } from "./allowlist.ts";
import { describeFetchError } from "./downloadImage.ts";
import type { CoreRoutesConfig } from "./types.ts";

export type { DownloadImageRequestBody, DownloadImageResponseBody };

const downloadImageAsFileRequestSchema = z.object({
  url: z.string().min(1, "url is required"),
  path: z.string().min(1, "path is required"),
});

/**
 * Returns true when the file exists and is accessible, false
 * otherwise (any access error is treated as "not found"). Mirrors
 * the original `Bun.file().exists()` semantics used by
 * `apps/cli/src/utils/downloadImage.ts`.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  return url;
}

/**
 * Pure function backing `POST /api/downloadImage`.
 *
 * Mirrors the original `apps/cli/src/route/DownloadImageAsFile.ts`
 * + `apps/cli/src/utils/downloadImage.ts` behavior:
 *   - zod-validates the body (`url` + `path` non-empty).
 *   - If the destination file already exists, returns
 *     `{ data: { url, path }, error: existedFileError(path) }`
 *     without performing any network I/O.
 *   - Resolves `path` to a platform path, asserts it is in the
 *     allowlist.
 *   - Fetches the URL with the same browser-like headers used
 *     by `doDownloadImage` (no `sec-fetch-mode: no-cors` —
 *     matches the original utility, which sends plain
 *     `accept` / `user-agent` only).
 *   - On non-2xx, returns `{ data, error: 'HTTP error! status: <n>' }`.
 *   - On success, writes the bytes to the platform path and
 *     returns `{ data: { url, path } }`.
 *
 * All errors are caught and mapped to a `{ data, error }`
 * response shape (no throws) — this matches the original
 * Hono handler contract.
 */
export async function doDownloadImageAsFile(
  body: DownloadImageRequestBody,
  config: Pick<CoreRoutesConfig, "allowlist" | "logger" | "fetchImpl">,
): Promise<DownloadImageResponseBody> {
  const { allowlist, logger, fetchImpl = fetch } = config;

  try {
    const validationResult = downloadImageAsFileRequestSchema.safeParse(body);
    if (!validationResult.success) {
      logger?.info(
        { issues: validationResult.error.issues },
        "[DownloadImageAsFile] validation failed",
      );
      return {
        data: {
          url: typeof body?.url === "string" ? body.url : "",
          path: typeof body?.path === "string" ? body.path : "",
        },
        error: `Validation failed: ${validationResult.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      };
    }

    const { url, path: destPath } = validationResult.data;

    logger?.debug({ url, destPath }, "[DownloadImageAsFile] processing request");

    // Resolve to POSIX for allowlist validation, then back to
    // platform for the actual `writeFile` call.
    const posixDestPath = path.posix.resolve(Path.posix(destPath));
    if (!validatePathIsInAllowlist(posixDestPath, allowlist)) {
      logger?.warn(
        { destPath, posixDestPath },
        "[DownloadImageAsFile] destination not in allowlist",
      );
      return {
        data: { url, path: destPath },
        error: `Path "${destPath}" is not in the allowlist`,
      };
    }

    const platformDestPath = Path.toPlatformPath(posixDestPath);

    // Idempotency: if the file already exists, mirror the
    // original `Bun.file().exists()` short-circuit.
    if (await fileExists(platformDestPath)) {
      logger?.info(
        { platformDestPath },
        "[DownloadImageAsFile] destination already exists",
      );
      return {
        data: { url, path: destPath },
        error: existedFileError(platformDestPath),
      };
    }

    const normalizedUrl = normalizeUrl(url);
    if (
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      return {
        data: { url, path: destPath },
        error: `Invalid image URL: ${url}. Must be http://, https://, or protocol-relative (//)`,
      };
    }

    logger?.debug(
      { url: normalizedUrl, destPath: platformDestPath },
      "[DownloadImageAsFile] fetching image",
    );

    let response: Response;
    try {
      response = await fetchImpl(normalizedUrl, {
        method: "GET",
        headers: {
          accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
          "sec-fetch-dest": "image",
          "sec-fetch-mode": "no-cors",
          "sec-fetch-site": "cross-site",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
    } catch (error) {
      return {
        data: { url, path: destPath },
        error: `Image URL fetch failed: ${describeFetchError(error)}`,
      };
    }

    if (!response.ok) {
      logger?.warn(
        { url: normalizedUrl, status: response.status },
        "[DownloadImageAsFile] non-2xx response",
      );
      return {
        data: { url, path: destPath },
        error: `HTTP error! status: ${response.status}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(platformDestPath, buffer);
    logger?.info(
      { url: normalizedUrl, destPath: platformDestPath, bytes: buffer.length },
      "[DownloadImageAsFile] wrote file",
    );

    return { data: { url, path: destPath } };
  } catch (error) {
    logger?.error({ error }, "[DownloadImageAsFile] unexpected error");
    return {
      data: {
        url: typeof body?.url === "string" ? body.url : "",
        path: typeof body?.path === "string" ? body.path : "",
      },
      error: `Unexpected Error: ${describeFetchError(error)}`,
    };
  }
}
