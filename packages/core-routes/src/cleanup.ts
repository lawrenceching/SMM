import type { ChatFs } from "./chatTypes.ts";
import type { CoreRoutesLogger } from "./types.ts";
import { defaultChatFs } from "./chatFs.ts";
import { cleanPreparingPlans } from "./tools/plans.ts";

/**
 * Remove stale plan files left over from a previous session.
 *
 * Plan files with status `preparing` represent tasks that were started
 * but never finalised (e.g. the user closed the app mid-preparation, or
 * the process was killed). They cannot be resumed — the workflow that
 * produced them is gone — so the next session treats them as garbage.
 *
 * `pending` plans are preserved (the user may still review them).
 * `rejected` plans are also preserved so in-flight AI tool calls can
 * detect the cancellation. `completed` plans are already deleted by
 * `updatePlanContent` and will not appear here.
 *
 * @param appDataDir The SMM `appDataDir` (e.g. from `getUserConfig`
 *   `userDataDir` on Electron, or `getAppDataDir()` on cli).
 * @param fs Optional `ChatFs` override. Defaults to `defaultChatFs()`
 *   which is `node:fs/promises`-backed and works on both Bun and Node.
 * @param logger Optional structured logger. When provided, the function
 *   logs scan start, per-file decisions, and a completion summary so
 *   operators can trace what was cleaned up and why.
 * @returns The number of `preparing` plan files that were deleted.
 */
export async function cleanupStalePlans(
  appDataDir: string,
  fs: ChatFs = defaultChatFs(),
  logger?: CoreRoutesLogger,
): Promise<number> {
  return cleanPreparingPlans(appDataDir, fs, logger);
}
