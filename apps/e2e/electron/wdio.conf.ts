import fs from 'node:fs'
import { WDIO_CACHE_DIR } from '../lib/wdioCacheDir'

const DEFAULT_SMM_BINARY = String.raw`C:\Users\lawrence\AppData\Local\Programs\SMM\SMM.exe`

const appBinaryPath = process.env.SMM_ELECTRON_BINARY ?? DEFAULT_SMM_BINARY

if (!fs.existsSync(appBinaryPath)) {
    throw new Error(
        `SMM Electron binary not found at "${appBinaryPath}". ` +
            `Install SMM or set SMM_ELECTRON_BINARY to the executable path.`,
    )
}

/**
 * Isolated WDIO config for installed SMM Electron app smoke tests.
 * Does not share Chrome/browser testbed setup from ../wdio.conf.ts.
 */
export const config: WebdriverIO.Config = {
    runner: 'local',
    tsConfigPath: '../tsconfig.json',

    cacheDir: WDIO_CACHE_DIR,

    specs: ['./hello.e2e.ts'],

    maxInstances: 1,

    capabilities: [
        {
            browserName: 'electron',
            // Match apps/electron's electron major so Chromedriver is resolved correctly
            // when the app under test lives outside this package.
            browserVersion: '39.2.6',
            'wdio:electronServiceOptions': {
                appBinaryPath,
            },
        },
    ],

    logLevel: 'warn',
    // CDP bridge may fail when EnableNodeCliInspectArguments fuse is off;
    // smoke tests only need the renderer session (getTitle), so silence it.
    logLevels: {
        'electron-service:bridge': 'silent',
    },
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    services: ['electron'],

    framework: 'mocha',
    reporters: ['spec'],

    mochaOpts: {
        ui: 'bdd',
        // Common specs (e.g. TVShow-Import) may raise per-test timeouts further.
        timeout: 6 * 60 * 1000,
    },
}
