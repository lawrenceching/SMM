/**
 * Browser-protocol filesystem helpers for e2e setup/cleanup.
 * All I/O goes through WDIO `browser.execute` + same-origin `fetch('/api/...')`.
 */
import type { UserConfig } from '@smm/core/types'
import { resolveUiPageUrl, type TestbedOs } from './ui-page-url'

/** Active OS for nested helpers during setup/cleanup (default `"general"`). */
let activeTestbedOs: TestbedOs = 'general'

export function setActiveTestbedOs(os: TestbedOs): void {
    activeTestbedOs = os
}

export function getActiveTestbedOs(): TestbedOs {
    return activeTestbedOs
}

export function joinPlatformPath(base: string, segment: string): string {
    const sep = base.includes('\\') ? '\\' : '/'
    return `${base.replace(/[\\/]+$/, '')}${sep}${segment}`
}

/**
 * True when `currentUrl` shares the same http(s) origin as the e2e UI target URL.
 */
export function isOnUiPageOrigin(
    currentUrl: string,
    targetUrl: string = resolveUiPageUrl(undefined, getActiveTestbedOs()),
): boolean {
    try {
        const current = new URL(currentUrl)
        const target = new URL(targetUrl)
        if (current.protocol !== 'http:' && current.protocol !== 'https:') {
            return false
        }
        return current.origin === target.origin
    } catch {
        return false
    }
}

/**
 * If the browser is not already on the UI origin, navigate via Page.open.
 */
export async function ensureBrowserOnUiPage(os: TestbedOs = getActiveTestbedOs()): Promise<void> {
    const targetUrl = resolveUiPageUrl(undefined, os)
    let currentUrl = ''
    try {
        currentUrl = await browser.getUrl()
    } catch (error) {
        console.warn('ensureBrowserOnUiPage: getUrl failed, will open page:', error)
    }

    if (isOnUiPageOrigin(currentUrl, targetUrl)) {
        return
    }

    console.log(
        `ensureBrowserOnUiPage: current="${currentUrl}" is not on UI origin of "${targetUrl}", opening page`,
    )
    const { default: Page } = await import('../pageobjects/page')
    await Page.open(undefined, os)
}

type HelloPaths = {
    appDataDir: string
    userDataDir: string
    tmpDir?: string
}

export async function fetchHelloPathsViaBrowser(): Promise<HelloPaths> {
    await ensureBrowserOnUiPage()
    const authToken = process.env.SMM_AUTH_TOKEN

    const result = await browser.execute(async (token: string | undefined) => {
        const headers: Record<string, string> = {}
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }
        const helloRes = await fetch('/api/hello', { method: 'POST', headers })
        const helloBody = await helloRes.json() as {
            appDataDir?: string
            userDataDir?: string
            tmpDir?: string
        }
        if (!helloBody.appDataDir || !helloBody.userDataDir) {
            return {
                error: `hello missing paths: ${JSON.stringify(helloBody)}`,
                appDataDir: null as string | null,
                userDataDir: null as string | null,
                tmpDir: null as string | null,
            }
        }
        return {
            error: null as string | null,
            appDataDir: helloBody.appDataDir,
            userDataDir: helloBody.userDataDir,
            tmpDir: helloBody.tmpDir ?? null,
        }
    }, authToken) as unknown as {
        error: string | null
        appDataDir: string | null
        userDataDir: string | null
        tmpDir: string | null
    }

    if (result.error || !result.appDataDir || !result.userDataDir) {
        throw new Error(`fetchHelloPathsViaBrowser failed: ${result.error ?? 'missing paths'}`)
    }

    return {
        appDataDir: result.appDataDir,
        userDataDir: result.userDataDir,
        tmpDir: result.tmpDir ?? undefined,
    }
}

/**
 * Delete a directory under the app allowlist via `POST /api/deleteFolder`.
 */
export async function deleteFolderViaBrowser(folderPath: string): Promise<string> {
    await ensureBrowserOnUiPage()
    const authToken = process.env.SMM_AUTH_TOKEN

    const result = await browser.execute(async (token: string | undefined, pathToDelete: string) => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }
        const delRes = await fetch('/api/deleteFolder', {
            method: 'POST',
            headers,
            body: JSON.stringify({ path: pathToDelete }),
        })
        const delBody = await delRes.json() as { data?: { path?: string }; error?: string }
        return {
            error: delBody.error ?? null,
            path: pathToDelete,
        }
    }, authToken, folderPath) as unknown as { error: string | null; path: string }

    if (result.error) {
        throw new Error(`deleteFolderViaBrowser failed for "${folderPath}": ${result.error}`)
    }
    return result.path
}

export async function deleteAppDataSubdirViaBrowser(subdir: string): Promise<string> {
    const { appDataDir } = await fetchHelloPathsViaBrowser()
    const dirPath = joinPlatformPath(appDataDir, subdir)
    await deleteFolderViaBrowser(dirPath)
    return dirPath
}

export async function readFileViaBrowser(filePath: string): Promise<string> {
    await ensureBrowserOnUiPage()
    const authToken = process.env.SMM_AUTH_TOKEN

    const result = await browser.execute(async (token: string | undefined, pathToRead: string) => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }
        const res = await fetch('/api/readFile', {
            method: 'POST',
            headers,
            body: JSON.stringify({ path: pathToRead }),
        })
        const body = await res.json() as { data?: string; error?: string }
        return {
            error: body.error ?? null,
            data: body.data ?? null,
        }
    }, authToken, filePath) as unknown as { error: string | null; data: string | null }

    if (result.error || result.data === null) {
        throw new Error(`readFileViaBrowser failed for "${filePath}": ${result.error ?? 'no data'}`)
    }
    return result.data
}

export async function writeFileViaBrowser(filePath: string, content: string): Promise<void> {
    await ensureBrowserOnUiPage()
    const authToken = process.env.SMM_AUTH_TOKEN

    const result = await browser.execute(
        async (token: string | undefined, pathToWrite: string, data: string) => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            }
            if (token) {
                headers['Authorization'] = `Bearer ${token}`
            }
            const res = await fetch('/api/writeFile', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    path: pathToWrite,
                    mode: 'overwrite',
                    data,
                }),
            })
            const body = await res.json() as { error?: string }
            return { error: body.error ?? null }
        },
        authToken,
        filePath,
        content,
    ) as unknown as { error: string | null }

    if (result.error) {
        throw new Error(`writeFileViaBrowser failed for "${filePath}": ${result.error}`)
    }
}

export function buildDefaultUserConfig(initConfig?: Partial<UserConfig>): UserConfig {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY

    const userConfig: UserConfig = {
        applicationLanguage: 'en',
        tmdb: {},
        folders: [],
        renameRules: [],
        dryRun: false,
        aiProviders: [
            {
                name: 'DeepSeek',
                baseURL: 'https://api.deepseek.com',
                model: 'deepseek-v4-flash',
                apiKey: deepseekApiKey,
            },
        ],
        preferMediaLanguage: undefined,
        selectedAIProvider: 'DeepSeek',
        selectedTMDBIntance: 'public',
        selectedRenameRule: 'Plex(TvShow/Anime)',
        enableMcpServer: false,
        mcpHost: '127.0.0.1',
        mcpPort: 30001,
    }

    return initConfig ? { ...userConfig, ...initConfig } : userConfig
}

export async function resetUserConfigViaBrowser(initConfig?: Partial<UserConfig>): Promise<string> {
    const { userDataDir } = await fetchHelloPathsViaBrowser()
    const userConfigPath = joinPlatformPath(userDataDir, 'smm.json')
    const userConfig = buildDefaultUserConfig(initConfig)
    await writeFileViaBrowser(userConfigPath, JSON.stringify(userConfig, null, 2))
    console.log(`Reset user config (v2): ${userConfigPath}`)
    console.log(`[DIAG] resetUserConfig v2: wrote folders=${JSON.stringify(userConfig.folders)} to ${userConfigPath}`)
    return userConfigPath
}

export async function updateUserConfigViaBrowser(
    updateFn: (userConfig: UserConfig) => UserConfig | void | Promise<UserConfig | void>,
): Promise<void> {
    const { userDataDir } = await fetchHelloPathsViaBrowser()
    const userConfigPath = joinPlatformPath(userDataDir, 'smm.json')
    const raw = await readFileViaBrowser(userConfigPath)
    const current = JSON.parse(raw) as UserConfig
    const next = await Promise.resolve(updateFn(current))
    const toWrite = next ?? current
    await writeFileViaBrowser(userConfigPath, JSON.stringify(toWrite, null, 2))
    console.log(`Updated user config (v2): ${userConfigPath}`)
    console.log(`[DIAG] updateUserConfig v2: wrote folders=${JSON.stringify(toWrite.folders)} to ${userConfigPath}`)
}
