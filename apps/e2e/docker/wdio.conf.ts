/**
 * Isolated WDIO config for SMM Docker (`smm:latest` on http://localhost:30000).
 * Shares Chrome cache / BiDi browser console / network-log patterns with desktop,
 * but does not start local cli/ui — the container serves both.
 */
import path from 'node:path'
import fs from 'node:fs'
import { ReportAggregator } from 'wdio-html-nice-reporter'
import { browser } from '@wdio/globals'
import { WDIO_CACHE_DIR } from '../lib/wdioCacheDir'
import { registerExpectExtensions } from '../test/lib/expect-extensions'
import {
    clearNetworkLogDir,
    initNetworkLogCapture,
    isNetworkLogEnabled,
    saveNetworkLog,
    setupNetworkLogCapture,
} from '../test/lib/networkLogCapture'
import { applyE2eWindowSize } from '../test/lib/e2e-window-size'

const HTML_REPORT_DIR = './reports/html-reports'
const PINNED_CHROME_VERSION = '146.0.7680.153'
const LOCAL_CHROME_BINARY = path.join(
    WDIO_CACHE_DIR,
    'chrome',
    `win64-${PINNED_CHROME_VERSION}`,
    'chrome-win64',
    'chrome.exe',
)
const LOCAL_CHROMEDRIVER_BINARY = path.join(
    WDIO_CACHE_DIR,
    'chromedriver',
    `win64-${PINNED_CHROME_VERSION}`,
    'chromedriver-win64',
    'chromedriver.exe',
)
const USE_LOCAL_CHROME_BINARY = fs.existsSync(LOCAL_CHROME_BINARY)
const USE_LOCAL_CHROMEDRIVER_BINARY = fs.existsSync(LOCAL_CHROMEDRIVER_BINARY)

function resolveExistingBinaryPath(envValue: string | undefined): string | undefined {
    if (!envValue) return undefined
    return fs.existsSync(envValue) ? envValue : undefined
}

const CI_CHROME_BINARY = resolveExistingBinaryPath(process.env.CHROME_BIN)
const CI_CHROMEDRIVER_BINARY = resolveExistingBinaryPath(
    process.env.CHROMEDRIVER ?? process.env.CHROMEWEBDRIVER,
)

const CHROME_BINARY =
    CI_CHROME_BINARY ?? (USE_LOCAL_CHROME_BINARY ? LOCAL_CHROME_BINARY : undefined)
const CHROMEDRIVER_BINARY =
    CI_CHROMEDRIVER_BINARY ??
    (USE_LOCAL_CHROMEDRIVER_BINARY ? LOCAL_CHROMEDRIVER_BINARY : undefined)

let reportAggregator: ReportAggregator | undefined

type BrowserLogEntry = {
    type?: string
    text?: string
    args?: unknown[]
}

const stringifyUnknown = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (value instanceof Error) return value.stack ?? value.message
    try {
        return JSON.stringify(value, null, 2)
    } catch {
        return String(value)
    }
}

const formatLogArg = (arg: unknown): string => {
    if (!arg || typeof arg !== 'object') {
        return stringifyUnknown(arg)
    }

    const value = arg as Record<string, unknown>
    const stack = value.stack
    if (typeof stack === 'string' && stack.length > 0) {
        return stack
    }

    const description = value.description
    if (typeof description === 'string' && description.length > 0) {
        return description
    }

    return stringifyUnknown(arg)
}

const formatBrowserLogEntry = (entry: BrowserLogEntry): string => {
    const baseText = typeof entry.text === 'string' ? entry.text : ''
    const argsText = Array.isArray(entry.args)
        ? entry.args.map((a) => formatLogArg(a)).filter(Boolean).join('\n')
        : ''

    if (baseText && argsText) return `${baseText}\n${argsText}`
    return baseText || argsText || ''
}

/**
 * Host Chrome talking to docker-served UI on :30000.
 * Runner always passes `--spec`; default specs are for ad-hoc manual runs only.
 */
export const config: WebdriverIO.Config = {
    runner: 'local',
    tsConfigPath: '../tsconfig.json',

    cacheDir: WDIO_CACHE_DIR,

    specs: ['../common/**/*.e2e.ts'],
    // Manual specs are opt-in via explicit --spec (ci/run-e2e-test.ts); do not exclude here
    // or wdio drops them even when --spec targets common/manual/*.e2e.ts.

    maxInstances: 1,

    capabilities: [
        {
            browserName: 'chrome',
            ...(CHROME_BINARY ? {} : { browserVersion: PINNED_CHROME_VERSION }),
            ...(CHROMEDRIVER_BINARY
                ? {
                      'wdio:chromedriverOptions': {
                          binary: CHROMEDRIVER_BINARY,
                      },
                  }
                : {}),
            'goog:chromeOptions': {
                ...(CHROME_BINARY ? { binary: CHROME_BINARY } : {}),
                args: [
                    '--disable-gpu',
                    '--no-sandbox',
                    '--force-device-scale-factor=1',
                ],
            },
        },
    ],

    logLevel: 'warn',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    framework: 'mocha',
    reporters: [
        'spec',
        [
            'html-nice',
            {
                outputDir: HTML_REPORT_DIR,
                filename: 'report.html',
                reportTitle: 'SMM E2E (docker)',
                linkScreenshots: true,
                showInBrowser: false,
                collapseTests: false,
                useOnAfterCommandForScreenshot: true,
            },
        ],
    ],

    mochaOpts: {
        ui: 'bdd',
        timeout: 6 * 60 * 1000,
    },

    onPrepare(_config, capabilities) {
        const caps = Array.isArray(capabilities) ? capabilities[0] : capabilities
        const browserName =
            caps && typeof caps === 'object' && 'browserName' in caps && caps.browserName
                ? String(caps.browserName)
                : 'chrome'
        reportAggregator = new ReportAggregator({
            outputDir: HTML_REPORT_DIR,
            filename: 'master-report.html',
            reportTitle: 'SMM E2E docker (master)',
            browserName,
            collapseTests: true,
            showInBrowser: false,
        })
        reportAggregator.clean()
    },

    beforeSession(_config, _capabilities, specs, cid) {
        initNetworkLogCapture(cid, specs)
        if (isNetworkLogEnabled()) {
            clearNetworkLogDir()
        }
    },

    before: async function () {
        registerExpectExtensions()
        await applyE2eWindowSize()

        const browserLogEnabled = process.env.BROWSER_LOG_ENABLED === 'true'
        if (browserLogEnabled) {
            browser.sessionSubscribe({ events: ['log.entryAdded'] })

            browser.on('log.entryAdded', (logEntry) => {
                const logType = logEntry.type || 'info'
                const logText = formatBrowserLogEntry(logEntry as BrowserLogEntry)
                const timestamp = new Date().toISOString()

                switch (logType) {
                    case 'error':
                        console.error(`[BROWSER CONSOLE ERROR] ${timestamp} - ${logText}`)
                        break
                    case 'warning':
                    case 'warn':
                        console.warn(`[BROWSER CONSOLE WARN] ${timestamp} - ${logText}`)
                        break
                    case 'info':
                        console.log(`[BROWSER CONSOLE INFO] ${timestamp} - ${logText}`)
                        break
                    default:
                        console.log(`[BROWSER CONSOLE] ${timestamp} - ${logText}`)
                }
            })

            // NOTE: TypeScript event typings may not include `pageerror` for the current WebDriver BiDi adapter.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(browser as any).on('pageerror', (error: any) => {
                const errorMessage = error?.message ?? String(error)
                console.error(`[BROWSER PAGE ERROR] ${errorMessage}`)
            })
        }

        await setupNetworkLogCapture(browser)
    },

    afterTest: async function () {
        await browser.takeScreenshot()
    },

    after: async function () {
        saveNetworkLog()
    },

    async onComplete() {
        if (reportAggregator) {
            await reportAggregator.createReport()
        }
    },
}
