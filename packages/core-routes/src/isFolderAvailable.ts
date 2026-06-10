import { stat } from "node:fs/promises";
import { z } from "zod/v3";

/**
 * Request body for `POST /api/isFolderAvailable`.
 */
export interface IsFolderAvailableRequestBody {
 /**
 * Absolute or resolved folder path as understood by the server
 * (native OS form). Must be a non-empty string.
 */
 path: string;
}

/**
 * Response body for `POST /api/isFolderAvailable`.
 */
export interface IsFolderAvailableResponseBody {
 /**
 * True iff `stat` succeeds on the path and the entry is a
 * directory (after symlink resolution).
 */
 available: boolean;
}

const isFolderAvailableRequestSchema = z.object({
 path: z.string().min(1, "path is required"),
});

/**
 * True when the path exists, is accessible, and is a directory
 * (after symlink resolution).
 *
 * Mirrors the previous `checkFolderPathAvailable` helper in
 * `apps/cli/src/route/IsFolderAvailable.ts`.
 */
export async function checkFolderPathAvailable(folderPath: string): Promise<boolean> {
 try {
 const s = await stat(folderPath);
 return s.isDirectory();
 } catch {
 return false;
 }
}

/**
 * Pure function backing `POST /api/isFolderAvailable`.
 *
 * Validates the body via zod. On validation failure (e.g. missing
 * `path`), returns `{ available: false }` rather than throwing so
 * the response shape is always `IsFolderAvailableResponseBody`. The
 * Node `http` handler in `routes/isFolderAvailableRoute.ts` does its
 * own validation and maps the failure to HTTP400 with the
 * issue list, preserving the prior Hono behavior.
 *
 * Invalid JSON (parse error) is the caller's responsibility — the
 * pure function expects a parsed object.
 */
export async function doIsFolderAvailable(
 body: IsFolderAvailableRequestBody,
): Promise<IsFolderAvailableResponseBody> {
 const parsed = isFolderAvailableRequestSchema.safeParse(body);
 if (!parsed.success) {
 return { available: false };
 }
 const available = await checkFolderPathAvailable(parsed.data.path);
 return { available };
}
