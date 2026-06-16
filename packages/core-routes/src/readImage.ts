import { Buffer } from "node:buffer";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { z } from "zod/v3";
import { Path } from "@smm/core/path";
import { fileNotFoundError } from "@smm/core/errors";
import type {
  ReadImageRequestBody,
  ReadImageResponseBody,
} from "@smm/core/types";
import { validatePathIsInAllowlist } from "./allowlist.ts";
import type { CoreRoutesConfig } from "./types.ts";

export type { ReadImageRequestBody, ReadImageResponseBody };

const readImageRequestSchema = z.object({
  path: z.string().min(1, "path is required"),
});

/**
 * Valid image file extensions. Mirrors the original
 * `apps/cli/src/route/ReadImage.ts:VALID_IMAGE_EXTENSIONS`.
 */
const VALID_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
  ".tiff",
  ".tif",
];

/**
 * Extension → MIME map. Mirrors the original
 * `apps/cli/src/route/ReadImage.ts:getImageMimeType`.
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
};

function isValidImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return (VALID_IMAGE_EXTENSIONS as string[]).includes(ext);
}

function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? "image/jpeg";
}

/**
 * Returns true when the file exists and is accessible, false
 * otherwise. Mirrors the original `Bun.file().exists()` semantics
 * used by `apps/cli/src/route/ReadImage.ts`.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure function backing `POST /api/readImage`.
 *
 * Mirrors the original `apps/cli/src/route/ReadImage.ts:processReadImage`
 * behavior, but is framework- and runtime-agnostic (uses
 * `node:fs/promises` instead of `Bun.file()`).
 *
 * Error semantics (mirrors the original):
 *   - `{ error: 'Validation failed: ...' }` on zod failure.
 *   - `{ error: 'Path "<p>" is not in the allowlist' }` on
 *     allowlist rejection.
 *   - `{ error: 'File is not a valid image file. Supported
 *     formats: ...' }` on a non-image extension.
 *   - `{ error: fileNotFoundError(filePath) }` when the file
 *     does not exist.
 *   - `{ error: 'Failed to read image file: <msg>' }` on other
 *     I/O errors.
 *   - `{ error: 'Unexpected error: <msg>' }` on outer try/catch.
 *   - `{ data: 'data:image/…;base64,…' }` on success.
 */
export async function doReadImage(
  body: ReadImageRequestBody,
  config: Pick<CoreRoutesConfig, "allowlist" | "logger">,
): Promise<ReadImageResponseBody> {
  const { allowlist, logger } = config;

  try {
    const validationResult = readImageRequestSchema.safeParse(body);
    if (!validationResult.success) {
      logger?.info(
        { issues: validationResult.error.issues },
        "[ReadImage] validation failed",
      );
      return {
        error: `Validation failed: ${validationResult.error.issues
          .map((i) => i.message)
          .join(", ")}`,
      };
    }

    const { path: filePath } = validationResult.data;

    // Resolve to POSIX for allowlist validation, then to a
    // platform path for the actual `readFile` call.
    const posixPath = path.posix.resolve(Path.posix(filePath));
    if (!validatePathIsInAllowlist(posixPath, allowlist)) {
      logger?.warn(
        { filePath, posixPath },
        "[ReadImage] path not in allowlist",
      );
      return {
        error: `Path "${filePath}" is not in the allowlist`,
      };
    }

    const platformPath = Path.toPlatformPath(posixPath);

    if (!isValidImageFile(platformPath)) {
      return {
        error: `File is not a valid image file. Supported formats: ${VALID_IMAGE_EXTENSIONS.join(
          ", ",
        )}`,
      };
    }

    if (!(await fileExists(platformPath))) {
      return {
        error: fileNotFoundError(filePath),
      };
    }

    try {
      const arrayBuffer = await readFile(platformPath);
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = getImageMimeType(platformPath);
      return {
        data: `data:${mimeType};base64,${base64}`,
      };
    } catch (error) {
      logger?.error(
        { filePath, platformPath, error },
        "[ReadImage] failed to read file",
      );
      return {
        error: `Failed to read image file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  } catch (error) {
    logger?.error({ error }, "[ReadImage] unexpected error");
    return {
      error: `Unexpected error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}
