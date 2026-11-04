/**
 * Run `fn` while `process.arch` is pinned.
 * Subtitle download is rejected on arm64; tests that describe the x64 path must not
 * follow the CI runner's real architecture.
 */
export async function withProcessArch<T>(arch: string, run: () => T | Promise<T>): Promise<T> {
    const previous = Object.getOwnPropertyDescriptor(process, 'arch')
    Object.defineProperty(process, 'arch', { configurable: true, enumerable: true, value: arch })
    try {
        return await run()
    } finally {
        if (previous) {
            Object.defineProperty(process, 'arch', previous)
        }
    }
}
