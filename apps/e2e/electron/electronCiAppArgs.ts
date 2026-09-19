/** Chromium flags required to launch Electron under GitHub-hosted Linux runners. */
const LINUX_CI_ELECTRON_ARGS = ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] as const

/**
 * Extra Electron launch args for CI.
 * GitHub Ubuntu runners have no desktop and block the Chromium SUID sandbox.
 * Local desktops, including Linux with a display, are left unchanged.
 */
export function electronCiAppArgs(env: { CI?: string }, platform: NodeJS.Platform): string[] {
    if (env.CI === 'true' && platform === 'linux') {
        return [...LINUX_CI_ELECTRON_ARGS]
    }
    return []
}
