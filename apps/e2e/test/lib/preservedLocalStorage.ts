/** Must match `AUTH_TOKEN_STORAGE_KEY` in apps/ui/src/lib/authToken.ts. */
export const E2E_PRESERVED_LOCAL_STORAGE_KEYS = ['auth-token'] as const

export function snapshotPreservedLocalStorageKeys(
    storage: Pick<Storage, 'getItem'>,
): Record<string, string> {
    const snapshot: Record<string, string> = {}
    for (const key of E2E_PRESERVED_LOCAL_STORAGE_KEYS) {
        const value = storage.getItem(key)
        if (value !== null) {
            snapshot[key] = value
        }
    }
    return snapshot
}

export function restorePreservedLocalStorageKeys(
    storage: Pick<Storage, 'setItem'>,
    snapshot: Record<string, string>,
): void {
    for (const [key, value] of Object.entries(snapshot)) {
        storage.setItem(key, value)
    }
}
