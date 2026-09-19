/**
 * Optional Chromedriver override for Electron e2e.
 * Set only on linux-arm64 CI, where WDIO's auto-download picks the x64 binary.
 */
export function resolveElectronChromedriverBinary(
    env: { CHROMEDRIVER?: string },
    fileExists: (candidate: string) => boolean,
): string | undefined {
    const candidate = env.CHROMEDRIVER
    if (!candidate) {
        return undefined
    }
    return fileExists(candidate) ? candidate : undefined
}
