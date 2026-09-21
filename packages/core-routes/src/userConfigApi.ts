import { z } from "zod/v3";
import type {
  GetUserConfigResponseBody,
  PatchUserConfigRequestBody,
  PatchUserConfigResponseBody,
} from "@smm/types";
import type { CoreRoutesConfig } from "./types.ts";
import { applyUserConfigPatch } from "./userConfigPatch.ts";
import {
  acquireUserConfigLock,
  readUserConfigDocument,
  resolveUserDataDir,
  userConfigFilePath,
  writeUserConfigFile,
} from "./userConfig.ts";

const patchRequestSchema = z.object({
  patch: z.array(
    z.object({
      op: z.string(),
      path: z.string(),
      value: z.unknown().optional(),
      from: z.string().optional(),
    }),
  ),
});

function reason(message: string): string {
  return `Error Reason: ${message}`;
}

/**
 * Pure function backing `POST /api/getUserConfig`.
 * Returns the persisted user config, or the default document when `smm.json` is absent.
 */
export async function doGetUserConfig(
  config: CoreRoutesConfig,
): Promise<GetUserConfigResponseBody> {
  const userDataDir = resolveUserDataDir(config);
  if (!userDataDir) {
    return { error: reason("userDataDir is not configured") };
  }
  const loaded = await readUserConfigDocument(userDataDir);
  if ("error" in loaded) {
    return { error: reason(loaded.error) };
  }
  return { data: loaded.config };
}

/**
 * Pure function backing `POST /api/patchUserConfig`.
 * Applies a restricted JSON Patch under the user-config file lock, validates, then writes `smm.json`.
 */
export async function doPatchUserConfig(
  body: PatchUserConfigRequestBody,
  config: CoreRoutesConfig,
): Promise<PatchUserConfigResponseBody> {
  const parsed = patchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      error: reason(
        `Validation Failed: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`,
      ),
    };
  }

  const userDataDir = resolveUserDataDir(config);
  if (!userDataDir) {
    return { error: reason("userDataDir is not configured") };
  }

  const release = await acquireUserConfigLock(userConfigFilePath(userDataDir));
  try {
    const loaded = await readUserConfigDocument(userDataDir);
    if ("error" in loaded) {
      return { error: reason(loaded.error) };
    }
    if (parsed.data.patch.length === 0) {
      return { data: loaded.config };
    }
    const next = applyUserConfigPatch(loaded.config, parsed.data.patch);
    await writeUserConfigFile(userDataDir, next);
    return { data: next };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to patch user config";
    return { error: reason(message) };
  } finally {
    release();
  }
}
