import { z } from "zod/v3";
import path from "node:path";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { Path } from "@smm/core/path";
import { fileNotFoundError } from "@smm/core/errors";
import type { ReadFileRequestBody, ReadFileResponseBody } from "@smm/core/types";
import { validatePathIsInAllowlist } from "./allowlist.ts";
import type { CoreRoutesConfig } from "./types.ts";

export type { ReadFileRequestBody, ReadFileResponseBody };

const readFileRequestSchema = z.object({
 path: z.string().min(1, "Path is required"),
 requireValidPath: z.boolean().optional(),
});

/**
 * Returns `true` when `filePath` exists and is accessible, `false`
 * otherwise (including on invalid UNC paths, permission errors, etc.).
 * Mirrors `Bun.file().exists()` semantics.
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
 * Reads the file at `filePath` and returns its UTF-8 decoded contents.
 * Returns `null` when the file is not accessible (any I/O error from
 * the access probe is treated as "not found" — this matches the
 * original `Bun.file().exists()` + `Bun.file().text()` semantics in
 * `apps/cli/src/route/ReadFile.ts`).
 */
export async function checkFileIsReadable(filePath: string): Promise<string | null> {
 if (!(await fileExists(filePath))) {
 return null;
 }
 try {
 return await readFile(filePath, "utf-8");
 } catch {
 // Race: file existed at `access` time but disappeared before `readFile`.
 // Treat as not-found to match the original Bun behavior.
 return null;
 }
}

/**
 * Pure function backing `POST /api/readFile`.
 *
 * Validates the body via zod. Optionally checks the allowlist
 * (default behavior, controlled by `requireValidPath`). Reads the
 * file via `node:fs/promises.readFile`. Mirrors the original
 * `apps/cli/src/route/ReadFile.ts` error semantics:
 *
 * - `{ error: 'Validation failed: ...' }` on zod failure.
 * - `{ error: 'Path "<path>" is not in the allowlist' }` on
 * allowlist rejection.
 * - `{ error: fileNotFoundError(filePath) }` (`File Not Found: <path>`)
 * when `checkFileIsReadable` returns `null`.
 * - `{ error: 'Failed to read file: <msg>' }` on other I/O errors.
 * - `{ error: 'Unexpected error: <msg>' }` on outer try/catch.
 * - `{ data }` on success.
 */
export async function doReadFile(
 body: ReadFileRequestBody,
 config: Pick<CoreRoutesConfig, "allowlist" | "logger">,
): Promise<ReadFileResponseBody> {
 const { logger, allowlist } = config;

 try {
 const validationResult = readFileRequestSchema.safeParse(body);

 if (!validationResult.success) {
 logger?.info(
 { issues: validationResult.error.issues },
 "doReadFile: validation failed",
 );
 return {
 error: `Validation failed: ${validationResult.error.issues
 .map((i) => i.message)
 .join(", ")}`,
 };
 }

 const { path: filePath, requireValidPath } = validationResult.data;

 logger?.debug({ filePath, requireValidPath }, "doReadFile: processing request");

 // Resolve to absolute POSIX path first for allowlist validation.
 const posixPath = Path.posix(filePath);
 const resolvedPath = path.posix.resolve(posixPath);

 if (requireValidPath === undefined || requireValidPath === true) {
 const isAllowed = validatePathIsInAllowlist(resolvedPath, allowlist);
 if (!isAllowed) {
 logger?.warn({ filePath }, "doReadFile: path not in allowlist");
 return {
 error: `Path "${filePath}" is not in the allowlist`,
 };
 }
 }

 // Resolve to platform-specific absolute path for file operations.
 const platformPath = Path.toPlatformPath(resolvedPath);

 try {
 const data = await checkFileIsReadable(platformPath);
 if (data === null) {
 logger?.info({ filePath, platformPath }, "doReadFile: file not found");
 return {
 error: fileNotFoundError(filePath),
 };
 }
 return { data };
 } catch (error) {
 logger?.error(
 { filePath, platformPath, error },
 "doReadFile: failed to read file",
 );
 return {
 error: `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
 };
 }
 } catch (error) {
 logger?.error({ error }, "doReadFile: unexpected error");
 return {
 error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
 };
 }
}
