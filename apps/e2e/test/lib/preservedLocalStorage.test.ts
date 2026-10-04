import { describe, expect, test } from 'bun:test'
import {
    restorePreservedLocalStorageKeys,
    snapshotPreservedLocalStorageKeys,
} from './preservedLocalStorage'

class MemoryStorage implements Storage {
    private data = new Map<string, string>()

    get length(): number {
        return this.data.size
    }

    clear(): void {
        this.data.clear()
    }

    getItem(key: string): string | null {
        return this.data.get(key) ?? null
    }

    key(index: number): string | null {
        return [...this.data.keys()][index] ?? null
    }

    removeItem(key: string): void {
        this.data.delete(key)
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value)
    }
}

describe('preservedLocalStorage', () => {
    test('keeps auth-token after storage.clear()', () => {
        const storage = new MemoryStorage()
        storage.setItem('auth-token', 'ChangeMe123')
        storage.setItem('cookie_guide_url', 'https://example.test')
        storage.setItem('sidebar.selectedFolder', '/media/show')

        const snapshot = snapshotPreservedLocalStorageKeys(storage)
        storage.clear()
        restorePreservedLocalStorageKeys(storage, snapshot)

        expect(storage.getItem('auth-token')).toBe('ChangeMe123')
        expect(storage.getItem('cookie_guide_url')).toBeNull()
        expect(storage.getItem('sidebar.selectedFolder')).toBeNull()
    })
})
