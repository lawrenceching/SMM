/** Browser localStorage key read by `isSmmV3Enabled()` in apps/ui. */
export const SMM_V3_LOCAL_STORAGE_KEY = 'smm.v3.enabled'

/**
 * Opt-in for e2e: `E2E_SMM_V3=true` injects `smm.v3.enabled` (production default is already on).
 * Any other value (unset, `"1"`, `"false"`) leaves v3 off.
 */
export function isE2eSmmV3Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.E2E_SMM_V3 === 'true'
}

/**
 * Keys to restore after `localStorage.clear()` so the v3 flag survives testbed cleanup.
 */
export function localStorageEntriesAfterClear(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  if (!isE2eSmmV3Enabled(env)) return {}
  return { [SMM_V3_LOCAL_STORAGE_KEY]: 'true' }
}
