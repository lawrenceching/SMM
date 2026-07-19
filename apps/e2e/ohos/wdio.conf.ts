import { execSync } from 'node:child_process'
import { WDIO_CACHE_DIR } from '../lib/wdioCacheDir'
import {
    startFrontendConsoleCapture,
    stopFrontendConsoleCapture,
} from './lib/frontend-console-capture'
import { startHilogCapture, stopHilogCapture } from './lib/hilog-capture'

const REMOTE_DEBUG_PORT = process.env.OHOS_REMOTE_DEBUG_PORT ?? '9222'
const DEBUGGER_ADDRESS = `127.0.0.1:${REMOTE_DEBUG_PORT}`
const FPORT_SPEC = `tcp:${REMOTE_DEBUG_PORT} tcp:${REMOTE_DEBUG_PORT}`

/** HarmonyOS Electron Chromium major — pin independently from browser/desktop Electron. */
const OHOS_CHROMIUM_VERSION = '132'

// Default on; set HDC_PORT_FORWARD_ENABLED=false to skip auto fport (manual forward).
const HDC_PORT_FORWARD_ENABLED = process.env.HDC_PORT_FORWARD_ENABLED !== 'false'

function hdc(cmd: string): string {
    return execSync(`hdc ${cmd}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
}

function assertDeviceConnected() {
    const output = hdc('list targets')
    console.log(`[ohos] hdc list targets:\n${output}`)

    const lines = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !/^\[Empty\]$/i.test(line))

    if (lines.length === 0) {
        throw new Error(
            'No HarmonyOS device connected (hdc list targets is empty). ' +
                'Connect a device/emulator before running ohos e2e.',
        )
    }
}

function assertPortNotAlreadyForwarded() {
    const output = hdc('fport ls')
    console.log(`[ohos] hdc fport ls:\n${output || '(empty)'}`)

    // Matches host-side tcp:9222 in fport listing (local or remote side).
    const portPattern = new RegExp(`tcp:${REMOTE_DEBUG_PORT}\\b`)
    if (portPattern.test(output)) {
        throw new Error(
            `Port ${REMOTE_DEBUG_PORT} is already forwarded (hdc fport ls). ` +
                `Remove it first: hdc fport rm ${FPORT_SPEC}`,
        )
    }
}

function setupPortForward() {
    const result = hdc(`fport ${FPORT_SPEC}`)
    console.log(`[ohos] hdc fport ${FPORT_SPEC}: ${result || 'ok'}`)
}

function teardownPortForward() {
    try {
        const result = hdc(`fport rm ${FPORT_SPEC}`)
        console.log(`[ohos] hdc fport rm ${FPORT_SPEC}: ${result || 'ok'}`)
    } catch (err) {
        console.warn(
            `[ohos] Failed to remove port forward ${FPORT_SPEC}:`,
            err instanceof Error ? err.message : err,
        )
    }
}

/**
 * Attach-mode WDIO config for HarmonyOS Electron.
 * Shares cacheDir with browser/electron configs; chromedriver version is pinned to 132.
 *
 * Port forwarding (default on):
 * - Auto `hdc fport` / `fport rm` around the suite unless `HDC_PORT_FORWARD_ENABLED=false`.
 * - When disabled, set up forwarding manually before the run.
 *
 * HiLog capture (default on): streams unfiltered `hdc shell hilog` to
 * `reports/ohos-hilog/hilog.log`, then derives `electron.log` on stop.
 * Disable with `OHOS_HILOG_CAPTURE=false`.
 *
 * Frontend console capture (default on): CDP `Runtime.consoleAPICalled` via the
 * same debugger port → `reports/ohos-hilog/frontend-console.log`.
 * Disable with `OHOS_FRONTEND_CONSOLE_CAPTURE=false`.
 *
 * Note: `browserVersion` alone makes WDIO download Chrome for Testing. Attach mode only
 * needs Chromedriver, so `goog:chromeOptions.binary` is set to skip the browser download
 * (see @wdio/utils setupPuppeteerBrowser). Chromedriver still resolves from browserVersion.
 */
export const config: WebdriverIO.Config = {
    runner: 'local',
    tsConfigPath: '../tsconfig.json',

    cacheDir: WDIO_CACHE_DIR,

    specs: ['./**/*.e2e.ts'],

    maxInstances: 1,

    capabilities: [
        {
            browserName: 'chrome',
            browserVersion: OHOS_CHROMIUM_VERSION,
            'wdio:enforceWebDriverClassic': true,
            'goog:chromeOptions': {
                // Skip downloading local Chrome — browser runs on the device.
                binary: '',
                debuggerAddress: DEBUGGER_ADDRESS,
            },
        },
    ],

    // Do not use wdio-electron-service — app runs on device, we only attach via CDP.
    services: [],

    logLevel: 'info',
    waitforTimeout: 15000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    framework: 'mocha',
    reporters: ['spec'],

    mochaOpts: {
        ui: 'bdd',
        timeout: 120000,
    },

    onPrepare: () => {
        assertDeviceConnected()
        startHilogCapture()

        if (!HDC_PORT_FORWARD_ENABLED) return

        assertPortNotAlreadyForwarded()
        setupPortForward()
    },

    /**
     * After Chromedriver attaches to debuggerAddress, open a CDP page session
     * and stream renderer console to disk (Classic WebDriver — no BiDi).
     */
    before: async () => {
        try {
            await startFrontendConsoleCapture(DEBUGGER_ADDRESS)
        } catch (err) {
            console.warn(
                '[ohos] Frontend console capture failed to start:',
                err instanceof Error ? err.message : err,
            )
        }
    },

    after: async () => {
        await stopFrontendConsoleCapture()
    },

    onComplete: async () => {
        await stopFrontendConsoleCapture()
        await stopHilogCapture()

        if (!HDC_PORT_FORWARD_ENABLED) return

        teardownPortForward()
    },
}
