import os from 'os';
import path from 'path';
import fs from 'fs';
import { ReportAggregator } from 'wdio-html-nice-reporter';
import { browser } from '@wdio/globals';
import { setup, updateUserConfig } from './test/lib/testbed';
import { registerExpectExtensions } from './test/lib/expect-extensions';
import {
    disableMcpFromStatusBarAndClearGlobal,
    enableMcpFromStatusBarAndStoreAddress,
} from './test/lib/mcpSpecShared';

const HTML_REPORT_DIR = './reports/html-reports';
const PINNED_CHROME_VERSION = '146.0.7680.153';
const WDIO_CACHE_DIR = path.join(os.homedir(), 'wdio-cache');
const LOCAL_CHROME_BINARY = path.join(
    WDIO_CACHE_DIR,
    'chrome',
    `win64-${PINNED_CHROME_VERSION}`,
    'chrome-win64',
    'chrome.exe'
);
const LOCAL_CHROMEDRIVER_BINARY = path.join(
    WDIO_CACHE_DIR,
    'chromedriver',
    `win64-${PINNED_CHROME_VERSION}`,
    'chromedriver-win64',
    'chromedriver.exe'
);
const USE_LOCAL_CHROME_BINARY = fs.existsSync(LOCAL_CHROME_BINARY);
const USE_LOCAL_CHROMEDRIVER_BINARY = fs.existsSync(LOCAL_CHROMEDRIVER_BINARY);

function resolveExistingBinaryPath(envValue: string | undefined): string | undefined {
    if (!envValue) return undefined;
    return fs.existsSync(envValue) ? envValue : undefined;
}

/** CI: browser-actions/setup-chrome sets CHROME_BIN and CHROMEDRIVER. */
const CI_CHROME_BINARY = resolveExistingBinaryPath(process.env.CHROME_BIN);
const CI_CHROMEDRIVER_BINARY = resolveExistingBinaryPath(
    process.env.CHROMEDRIVER ?? process.env.CHROMEWEBDRIVER,
);

const CHROME_BINARY =
    CI_CHROME_BINARY ?? (USE_LOCAL_CHROME_BINARY ? LOCAL_CHROME_BINARY : undefined);
const CHROMEDRIVER_BINARY =
    CI_CHROMEDRIVER_BINARY ??
    (USE_LOCAL_CHROMEDRIVER_BINARY ? LOCAL_CHROMEDRIVER_BINARY : undefined);

let reportAggregator: ReportAggregator | undefined;

type BrowserLogEntry = {
    type?: string;
    text?: string;
    args?: unknown[];
};

const stringifyUnknown = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack ?? value.message;

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const formatLogArg = (arg: unknown): string => {
    if (!arg || typeof arg !== 'object') {
        return stringifyUnknown(arg);
    }

    const value = arg as Record<string, unknown>;
    const stack = value.stack;
    if (typeof stack === 'string' && stack.length > 0) {
        return stack;
    }

    const description = value.description;
    if (typeof description === 'string' && description.length > 0) {
        return description;
    }

    const preview = value.preview;
    if (preview && typeof preview === 'object') {
        const previewProperties = (preview as Record<string, unknown>).properties;
        if (Array.isArray(previewProperties)) {
            const stackProperty = previewProperties.find((p) => {
                if (!p || typeof p !== 'object') return false;
                return (p as Record<string, unknown>).name === 'stack';
            }) as Record<string, unknown> | undefined;

            const stackValue = stackProperty?.value;
            if (typeof stackValue === 'string' && stackValue.length > 0) {
                return stackValue;
            }
        }
    }

    return stringifyUnknown(arg);
};

const formatBrowserLogEntry = (entry: BrowserLogEntry): string => {
    const baseText = typeof entry.text === 'string' ? entry.text : '';
    const argsText = Array.isArray(entry.args)
        ? entry.args.map((arg) => formatLogArg(arg)).filter(Boolean).join('\n')
        : '';

    if (baseText && argsText) return `${baseText}\n${argsText}`;
    return baseText || argsText || '';
};


function workerSpecsIncludeMcp(specs: string[] | undefined): boolean {
    if (!specs?.length) return false;
    return specs.some((specPath) => {
        const n = specPath.replace(/\\/g, '/');
        return n.includes('/specs/mcp/') || n.includes('/specs/tvdb/McpServerTools-TVDB');
    });
}

async function enableMcpServerForE2eWorker(): Promise<void> {
    await setup({
        removeMetadataDir: false,
        removePlansDir: false,
        removeMediaFolders: false,
        removeDirInSidebar: false,
        resetUserConfig: false,
        openBrowserPage: true,
    });

    await enableMcpFromStatusBarAndStoreAddress();
}

async function disableMcpServerForE2eWorker(): Promise<void> {
    await disableMcpFromStatusBarAndClearGlobal();
}

const chromeOptionsForDockerEnv: string[] = [
    '--window-size=1920,1080',
    '--disable-dev-shm-usage',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--headless=new',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--safebrowsing-disable-auto-update',
    // 容器环境需要禁用沙箱
    '--disable-setuid-sandbox',
    // 允许所有来源（开发环境）
    '--allow-running-insecure-content',
    '--unsafely-treat-insecure-origin-as-secure=http://*'
]

/** CI headless: Chrome launch args alone do not set the WebDriver window; apply via setWindowSize in `before`. */
export const DEFAULT_E2E_WINDOW_WIDTH = 1920
export const DEFAULT_E2E_WINDOW_HEIGHT = 1080

export function resolveE2eWindowSize(): { width: number; height: number } | null {
    const widthEnv = process.env.E2E_WINDOW_WIDTH
    const heightEnv = process.env.E2E_WINDOW_HEIGHT
    if (widthEnv && heightEnv) {
        const width = Number(widthEnv)
        const height = Number(heightEnv)
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            return { width, height }
        }
    }
    if (process.env.BUILD_ENV === 'docker') {
        return { width: DEFAULT_E2E_WINDOW_WIDTH, height: DEFAULT_E2E_WINDOW_HEIGHT }
    }
    return null
}

async function applyE2eWindowSize(): Promise<void> {
    const target = resolveE2eWindowSize()
    if (!target) return

    await browser.setWindowSize(target.width, target.height)
    const rect = await browser.getWindowRect()
    console.log(
        `[E2E] setWindowSize ${target.width}x${target.height}; ` +
            `getWindowRect=${rect.width}x${rect.height}; ` +
            `inner=${await browser.execute(() => `${window.innerWidth}x${window.innerHeight}`)}`,
    )
}

/**
 * https://webdriver.io/docs/capabilities/
 */
export const config: WebdriverIO.Config = {
    //
    // ====================
    // Runner Configuration
    // ====================
    // WebdriverIO supports running e2e tests as well as unit and component tests.
    runner: 'local',
    tsConfigPath: './tsconfig.json',

    //
    // ============
    // Cache Directory
    // ============
    // Directory to cache browser drivers
    cacheDir: WDIO_CACHE_DIR,
    
    //
    // ==================
    // Specify Test Files
    // ==================
    // Define which test specs should run. The pattern is relative to the directory
    // of the configuration file being run.
    //
    // The specs are defined as an array of spec files (optionally using wildcards
    // that will be expanded). The test for each spec file will be run in a separate
    // worker process. In order to have a group of spec files run in the same worker
    // process simply enclose them in an array within the specs array.
    //
    // The path of the spec files will be resolved relative from the directory of
    // of the config file unless it's absolute.
    //
    specs: [
        ['test/specs/**/*.ts']
    ],
    // Patterns to exclude.
    exclude: [
        // 'path/to/excluded/files'
    ],
    //
    // ============
    // Capabilities
    // ============
    // Define your capabilities here. WebdriverIO can run multiple capabilities at the same
    // time. Depending on the number of capabilities, WebdriverIO launches several test
    // sessions. Within your capabilities you can overwrite the spec and exclude options in
    // order to group specific specs to a specific capability.
    //
    // First, you can define how many instances should be started at the same time. Let's
    // say you have 3 different capabilities (Chrome, Firefox, and Safari) and you have
    // set maxInstances to 1; wdio will spawn 3 processes. Therefore, if you have 10 spec
    // files and you set maxInstances to 10, all spec files will get tested at the same time
    // and 30 processes will get spawned. The property handles how many capabilities
    // from the same test should run tests.
    //
    maxInstances: 1,
    //
    // If you have trouble getting all important capabilities together, check out the
    // Sauce Labs platform configurator - a great tool to configure your capabilities:
    // https://saucelabs.com/platform/platform-configurator
    //
    capabilities: [{
        browserName: 'chrome',
        // Use pinned browserVersion only when no pre-installed Chrome binary is available.
        ...(CHROME_BINARY ? {} : { browserVersion: PINNED_CHROME_VERSION }),
        ...(CHROMEDRIVER_BINARY
            ? {
                'wdio:chromedriverOptions': {
                    binary: CHROMEDRIVER_BINARY,
                },
            }
            : {}),
        // 显式启用 WebDriver BiDi 协议以支持 console 事件监听
        'goog:chromeOptions': {
            ...(CHROME_BINARY ? { binary: CHROME_BINARY } : {}),
            args: process.env.BUILD_ENV === 'docker'
                ? [
                    '--disable-gpu',
                    '--no-sandbox',
                    ...chromeOptionsForDockerEnv
                ]
                : [
                    '--disable-gpu',
                    '--no-sandbox',
                    // '--force-device-scale-factor=0.8'
                ]
        }
    }],

    //
    // ===================
    // Test Configurations
    // ===================
    // Define all options that are relevant for the WebdriverIO instance here
    //
    // Level of logging verbosity: trace | debug | info | warn | error | silent
    logLevel: 'warn',
    //
    // Set specific log levels per logger
    // loggers:
    // - webdriver, webdriverio
    // - @wdio/browserstack-service, @wdio/lighthouse-service, @wdio/sauce-service
    // - @wdio/mocha-framework, @wdio/jasmine-framework
    // - @wdio/local-runner
    // - @wdio/sumologic-reporter
    // - @wdio/cli, @wdio/config, @wdio/utils
    // Level of logging verbosity: trace | debug | info | warn | error | silent
    // logLevels: {
    //     webdriver: 'info',
    //     '@wdio/appium-service': 'info'
    // },
    //
    // If you only want to run your tests until a specific amount of tests have failed use
    // bail (default is 0 - don't bail, run all tests).
    bail: 0,
    //
    // Set a base URL in order to shorten url command calls. If your `url` parameter starts
    // with `/`, the base url gets prepended, not including the path portion of your baseUrl.
    // If your `url` parameter starts without a scheme or `/` (like `some/path`), the base url
    // gets prepended directly.
    // baseUrl: 'http://localhost:8080',
    //
    // Default timeout for all waitFor* commands.
    waitforTimeout: 10000,
    //
    // Default timeout in milliseconds for request
    // if browser driver or grid doesn't send response
    connectionRetryTimeout: 120000,
    //
    // Default request retries count
    connectionRetryCount: 3,
    //
    // Test runner services
    // Services take over a specific job you don't want to take care of. They enhance
    // your test setup with almost no effort. Unlike plugins, they don't add new
    // commands. Instead, they hook themselves up into the test process.
    // services: [],
    //
    // Framework you want to run your specs with.
    // The following are supported: Mocha, Jasmine, and Cucumber
    // see also: https://webdriver.io/docs/frameworks
    //
    // Make sure you have the wdio adapter package for the specific framework installed
    // before running any tests.
    framework: 'mocha',
    
    //
    // The number of times to retry the entire specfile when it fails as a whole
    // specFileRetries: 1,
    //
    // Delay in seconds between the spec file retry attempts
    // specFileRetriesDelay: 0,
    //
    // Whether or not retried spec files should be retried immediately or deferred to the end of the queue
    // specFileRetriesDeferred: false,
    //
    // Test reporter for stdout.
    // see also: https://webdriver.io/docs/dot-reporter
    // HTML report: https://webdriver.io/docs/wdio-html-nice-reporter/
    reporters: [
        'spec',
        [
            'html-nice',
            {
                outputDir: HTML_REPORT_DIR,
                filename: 'report.html',
                reportTitle: 'SMM E2E',
                linkScreenshots: true,
                showInBrowser: false,
                collapseTests: false,
                useOnAfterCommandForScreenshot: true,
            },
        ],
    ],

    // Options to be passed to Mocha.
    // See the full list at http://mochajs.org/
    mochaOpts: {
        ui: 'bdd',
        timeout: 5 * 60 * 1000
    },

    //
    // =====
    // Hooks
    // =====
    // WebdriverIO provides several hooks you can use to interfere with the test process in order to enhance
    // it and to build services around it. You can either apply a single function or an array of
    // methods to it. If one of them returns with a promise, WebdriverIO will wait until that promise got
    // resolved to continue.
    /**
     * Gets executed once before all workers get launched.
     * @param {object} config wdio configuration object
     * @param {Array.<Object>} capabilities list of capabilities details
     */
    onPrepare(_config, capabilities) {
        const caps = Array.isArray(capabilities) ? capabilities[0] : capabilities;
        const browserName =
            caps && typeof caps === 'object' && 'browserName' in caps && caps.browserName
                ? String(caps.browserName)
                : 'chrome';
        // Master HTML report: aggregates JSON emitted by the html-nice reporter (see package samples).
        reportAggregator = new ReportAggregator({
            outputDir: HTML_REPORT_DIR,
            filename: 'master-report.html',
            reportTitle: 'SMM E2E (master)',
            browserName,
            collapseTests: true,
            showInBrowser: false,
        });
        reportAggregator.clean();
    },
    /**
     * Gets executed before a worker process is spawned and can be used to initialize specific service
     * for that worker as well as modify runtime environments in an async fashion.
     * @param  {string} cid      capability id (e.g 0-0)
     * @param  {object} caps     object containing capabilities for session that will be spawn in the worker
     * @param  {object} specs    specs to be run in the worker process
     * @param  {object} args     object that will be merged with the main configuration once worker is initialized
     * @param  {object} execArgv list of string arguments passed to the worker process
     */
    // onWorkerStart: function (cid, caps, specs, args, execArgv) {
    // },
    /**
     * Gets executed just after a worker process has exited.
     * @param  {string} cid      capability id (e.g 0-0)
     * @param  {number} exitCode 0 - success, 1 - fail
     * @param  {object} specs    specs to be run in the worker process
     * @param  {number} retries  number of retries used
     */
    // onWorkerEnd: function (cid, exitCode, specs, retries) {
    // },
    /**
     * Gets executed just before initialising the webdriver session and test framework. It allows you
     * to manipulate configurations depending on the capability or spec.
     * @param {object} config wdio configuration object
     * @param {Array.<Object>} capabilities list of capabilities details
     * @param {Array.<String>} specs List of spec file paths that are to be run
     * @param {string} cid worker id (e.g. 0-0)
     */
    // beforeSession: function (config, capabilities, specs, cid) {
    // },
    /**
     * Gets executed before test execution begins. At this point you can access to all global
     * variables like `browser`. It is the perfect place to define custom commands.
     * @param {Array.<Object>} capabilities list of capabilities details
     * @param {Array.<String>} specs        List of spec file paths that are to be run
     * @param {object}         browser      instance of created browser/device session
     */
    before: async function (_capabilities, specs) {
        registerExpectExtensions();
        await applyE2eWindowSize();

        const browserLogEnabled = process.env.BROWSER_LOG_ENABLED === 'true';
        if (browserLogEnabled) {
            // 先订阅 BiDi 协议的 log 事件
            browser.sessionSubscribe({ events: ['log.entryAdded'] });

            // 监听浏览器 console 事件并输出到控制台
            // WebdriverIO v9 需要使用 BiDi 协议的 log.entryAdded 事件
            browser.on('log.entryAdded', (logEntry) => {
                const logType = logEntry.type || 'info';
                const logText = formatBrowserLogEntry(logEntry as BrowserLogEntry);
                const timestamp = new Date().toISOString();

                switch (logType) {
                    case 'error':
                        console.error(`[BROWSER CONSOLE ERROR] ${timestamp} - ${logText}`);
                        break;
                    case 'warning':
                    case 'warn':
                        console.warn(`[BROWSER CONSOLE WARN] ${timestamp} - ${logText}`);
                        break;
                    case 'info':
                        console.log(`[BROWSER CONSOLE INFO] ${timestamp} - ${logText}`);
                        break;
                    default:
                        console.log(`[BROWSER CONSOLE] ${timestamp} - ${logText}`);
                }
            });

            // 监听浏览器页面错误
            // NOTE: TypeScript event typings may not include `pageerror` for the current WebDriver BiDi adapter.
            (browser as any).on('pageerror', (error: any) => {
                const errorMessage = error?.message ?? String(error);
                console.error(`[BROWSER PAGE ERROR] ${errorMessage}`);
            });
        }

        // if (workerSpecsIncludeMcp(specs)) {
        //     await updateUserConfig((userConfig) => {
        //         userConfig.enableMcpServer = true;
        //         return userConfig;
        //     });
        // }
    },
    /**
     * Runs before a WebdriverIO command gets executed.
     * @param {string} commandName hook command name
     * @param {Array} args arguments that command would receive
     */
    // beforeCommand: function (commandName, args) {
    // },
    /**
     * Hook that gets executed before the suite starts
     * @param {object} suite suite details
     */
    // beforeSuite: function (suite) {
    // },
    /**
     * Function to be executed before a test (in Mocha/Jasmine) starts.
     */
    // beforeTest: function (test, context) {
    // },
    /**
     * Hook that gets executed _before_ a hook within the suite starts (e.g. runs before calling
     * beforeEach in Mocha)
     */
    // beforeHook: function (test, context, hookName) {
    // },
    /**
     * Hook that gets executed _after_ a hook within the suite starts (e.g. runs after calling
     * afterEach in Mocha)
     */
    // afterHook: function (test, context, { error, result, duration, passed, retries }, hookName) {
    // },
    /**
     * Function to be executed after a test (in Mocha/Jasmine only)
     * @param {object}  test             test object
     * @param {object}  context          scope object the test was executed with
     * @param {Error}   result.error     error object in case the test fails, otherwise `undefined`
     * @param {*}       result.result    return object of test function
     * @param {number}  result.duration  duration of test
     * @param {boolean} result.passed    true if test has passed, otherwise false
     * @param {object}  result.retries   information about spec related retries, e.g. `{ attempts: 0, limit: 0 }`
     */
    afterTest: async function (_test, _context, { passed }) {
        if (!passed) {
            await browser.takeScreenshot()
        }
    },


    /**
     * Hook that gets executed after the suite has ended
     * @param {object} suite suite details
     */
    // afterSuite: function (suite) {
    // },
    /**
     * Runs after a WebdriverIO command gets executed
     * @param {string} commandName hook command name
     * @param {Array} args arguments that command would receive
     * @param {number} result 0 - command success, 1 - command error
     * @param {object} error error object if any
     */
    // afterCommand: function (commandName, args, result, error) {
    // },
    /**
     * Gets executed after all tests are done. You still have access to all global variables from
     * the test.
     * @param {number} result 0 - test pass, 1 - test fail
     * @param {Array.<Object>} capabilities list of capabilities details
     * @param {Array.<String>} specs List of spec file paths that ran
     */
    after: async function (_result, _capabilities, specs) {
        // if (workerSpecsIncludeMcp(specs)) {
        //     await disableMcpServerForE2eWorker();
        // }
    },
    /**
     * Gets executed right after terminating the webdriver session.
     * @param {object} config wdio configuration object
     * @param {Array.<Object>} capabilities list of capabilities details
     * @param {Array.<String>} specs List of spec file paths that ran
     */
    // afterSession: function (config, capabilities, specs) {
    // },
    /**
     * Gets executed after all workers got shut down and the process is about to exit. An error
     * thrown in the onComplete hook will result in the test run failing.
     * @param {object} exitCode 0 - success, 1 - fail
     * @param {object} config wdio configuration object
     * @param {Array.<Object>} capabilities list of capabilities details
     * @param {<Object>} results object containing test results
     */
    async onComplete() {
        if (reportAggregator) {
            await reportAggregator.createReport();
        }
    },
    /**
    * Gets executed when a refresh happens.
    * @param {string} oldSessionId session ID of the old session
    * @param {string} newSessionId session ID of the new session
    */
    // onReload: function(oldSessionId, newSessionId) {
    // }
    /**
    * Hook that gets executed before a WebdriverIO assertion happens.
    * @param {object} params information about the assertion to be executed
    */
    // beforeAssertion: function(params) {
    // }
    /**
    * Hook that gets executed after a WebdriverIO assertion happened.
    * @param {object} params information about the assertion that was executed, including its results
    */
    // afterAssertion: function(params) {
    // }
}
