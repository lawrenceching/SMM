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
 *
 * Electron: wdio-electron-service already attached to the app window (embedded
 * CLI UI origin). Do not navigate to the Vite desktop URL.
 */
export async function ensureBrowserOnUiPage(os: TestbedOs = getActiveTestbedOs()): Promise<void> {
    if (process.env.E2E_PLATFORM === 'electron') {
        let currentUrl = ''
        try {
            currentUrl = await browser.getUrl()
        } catch (error) {
            throw new Error(
                `ensureBrowserOnUiPage (electron): getUrl failed: ${error instanceof Error ? error.message : String(error)}`,
            )
        }
        if (currentUrl.startsWith('http://') || currentUrl.startsWith('https://')) {
            return
        }
        throw new Error(
            `ensureBrowserOnUiPage (electron): expected http(s) app URL, got "${currentUrl}"`,
        )
    }

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
        const helloRes = await fetch('/api/hello', { method: 'GET', headers })
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
 * Delete a file under the app allowlist via `POST /api/deleteFile`.
 * ENOENT is treated as success by the API.
 */
export async function deleteFileViaBrowser(filePath: string): Promise<void> {
    await ensureBrowserOnUiPage()
    const authToken = process.env.SMM_AUTH_TOKEN

    // Use `failure` (not `error`) as the return key — some WDIO/Chromedriver
    // paths surface a returned `{ error: string }` as WebDriverError.
    const result = await browser.execute(async (token: string | undefined, pathToDelete: string) => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }
        const delRes = await fetch('/api/deleteFile', {
            method: 'POST',
            headers,
            body: JSON.stringify({ path: pathToDelete }),
        })
        const delBody = await delRes.json() as { error?: string }
        return { failure: delBody.error ?? null }
    }, authToken, filePath) as unknown as { failure: string | null }

    if (result.failure) {
        throw new Error(`deleteFileViaBrowser failed for "${filePath}": ${result.failure}`)
    }
}

/**
 * Delete a directory under the app allowlist via `POST /api/deleteFolder`.
 */
export async function deleteFolderViaBrowser(folderPath: string): Promise<string> {
    await ensureBrowserOnUiPage()
    const authToken = process.env.SMM_AUTH_TOKEN

    // Use `failure` (not `error`) as the return key — some WDIO/Chromedriver
    // paths surface a returned `{ error: string }` as WebDriverError.
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
            failure: delBody.error ?? null,
            path: pathToDelete,
        }
    }, authToken, folderPath) as unknown as { failure: string | null; path: string }

    if (result.failure) {
        throw new Error(`deleteFolderViaBrowser failed for "${folderPath}": ${result.failure}`)
    }
    return result.path
}

/**
 * Empty a directory on-device: delete all files (recursive), then remove empty dirs.
 *
 * Prefer this over {@link deleteFolderViaBrowser} for HarmonyOS `Download/` paths,
 * where recursive `rm` of the directory itself can return EPERM even though
 * individual file deletes succeed.
 */
export async function clearFolderViaBrowser(folderPath: string): Promise<void> {
    await ensureBrowserOnUiPage()
    const authToken = process.env.SMM_AUTH_TOKEN

    const listed = await browser.execute(async (token: string | undefined, pathToList: string) => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }
        const res = await fetch('/api/listFiles', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                path: pathToList,
                recursively: true,
                includeHiddenFiles: true,
            }),
        })
        const body = await res.json() as {
            data?: { items?: Array<{ path: string; isDirectory?: boolean }> }
            error?: string
        }
        return {
            failure: body.error ?? null,
            items: body.data?.items ?? [],
        }
    }, authToken, folderPath) as unknown as {
        failure: string | null
        items: Array<{ path: string; isDirectory?: boolean }>
    }

    if (listed.failure) {
        // Folder already gone, or HarmonyOS Download/ sandbox denying scandir —
        // treat as cleared so fixtures can recreate under the same base path.
        if (/ENOENT|EPERM|EACCES|no such file|not found|Cannot access|operation not permitted/i.test(listed.failure)) {
            console.warn(`clearFolderViaBrowser: skip list for "${folderPath}": ${listed.failure}`)
            return
        }
        throw new Error(`clearFolderViaBrowser listFiles failed for "${folderPath}": ${listed.failure}`)
    }

    const files = listed.items.filter((i) => !i.isDirectory)
    const dirs = listed.items
        .filter((i) => i.isDirectory)
        .map((i) => i.path)
        // deepest paths first so parents are removed after children
        .sort((a, b) => b.length - a.length)

    for (const file of files) {
        await deleteFileViaBrowser(file.path)
    }

    for (const dir of dirs) {
        try {
            await deleteFolderViaBrowser(dir)
        } catch (err) {
            console.warn(`clearFolderViaBrowser: skip dir delete "${dir}":`, err)
        }
    }

    try {
        await deleteFolderViaBrowser(folderPath)
    } catch (err) {
        console.warn(`clearFolderViaBrowser: skip root delete "${folderPath}":`, err)
    }
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

export type ListedFileItem = {
    path: string
    size: number
    mtime: number
    isDirectory: boolean
}

/**
 * List files/folders via `POST /api/listFiles`.
 */
export async function listFilesViaBrowser(
    folderPath: string,
    options?: {
        recursively?: boolean
        includeHiddenFiles?: boolean
        onlyFiles?: boolean
        onlyFolders?: boolean
    },
): Promise<ListedFileItem[]> {
    await ensureBrowserOnUiPage()
    const authToken = process.env.SMM_AUTH_TOKEN

    const result = await browser.execute(
        async (
            token: string | undefined,
            pathToList: string,
            opts: {
                recursively?: boolean
                includeHiddenFiles?: boolean
                onlyFiles?: boolean
                onlyFolders?: boolean
            },
        ) => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            }
            if (token) {
                headers['Authorization'] = `Bearer ${token}`
            }
            const res = await fetch('/api/listFiles', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    path: pathToList,
                    recursively: opts.recursively ?? false,
                    includeHiddenFiles: opts.includeHiddenFiles ?? false,
                    onlyFiles: opts.onlyFiles,
                    onlyFolders: opts.onlyFolders,
                }),
            })
            const body = await res.json() as {
                data?: {
                    items?: Array<{
                        path: string
                        size: number
                        mtime: number
                        isDirectory: boolean
                    }>
                }
                error?: string
            }
            return {
                failure: body.error ?? null,
                items: body.data?.items ?? [],
            }
        },
        authToken,
        folderPath,
        {
            recursively: options?.recursively,
            includeHiddenFiles: options?.includeHiddenFiles,
            onlyFiles: options?.onlyFiles,
            onlyFolders: options?.onlyFolders,
        },
    ) as unknown as { failure: string | null; items: ListedFileItem[] }

    if (result.failure) {
        throw new Error(`listFilesViaBrowser failed for "${folderPath}": ${result.failure}`)
    }
    return result.items
}

/** Basename of a platform path (POSIX or Windows). */
export function basenamePlatformPath(filePath: string): string {
    const parts = filePath.split(/[/\\]/).filter(Boolean)
    return parts[parts.length - 1] ?? filePath
}

/**
 * List entry names (files + dirs) in a folder — browser equivalent of `fs.readdirSync`.
 */
export async function listFileNamesViaBrowser(
    folderPath: string,
    options?: { recursively?: boolean; includeHiddenFiles?: boolean },
): Promise<string[]> {
    const items = await listFilesViaBrowser(folderPath, options)
    return items.map((item) => basenamePlatformPath(item.path))
}

/**
 * True when `filePath` exists as a non-directory entry under its parent folder.
 */
export async function fileExistsViaBrowser(filePath: string): Promise<boolean> {
    const parent = filePath.replace(/[/\\][^/\\]+$/, '')
    if (!parent || parent === filePath) {
        return false
    }
    const name = basenamePlatformPath(filePath)
    const items = await listFilesViaBrowser(parent)
    return items.some((item) => !item.isDirectory && basenamePlatformPath(item.path) === name)
}

/**
 * Size in bytes for a file listed under its parent directory.
 */
export async function getFileSizeViaBrowser(filePath: string): Promise<number> {
    const parent = filePath.replace(/[/\\][^/\\]+$/, '')
    const name = basenamePlatformPath(filePath)
    const items = await listFilesViaBrowser(parent)
    const match = items.find((item) => !item.isDirectory && basenamePlatformPath(item.path) === name)
    if (!match) {
        throw new Error(`getFileSizeViaBrowser: file not found "${filePath}"`)
    }
    return match.size
}

/**
 * `{tmpDir}/smm-test-folder` from `GET /api/hello` — shared fixture root for common specs.
 */
export async function resolveSmmTestFolderViaBrowser(): Promise<string> {
    const { tmpDir } = await fetchHelloPathsViaBrowser()
    if (!tmpDir) {
        throw new Error('GET /api/hello did not return tmpDir')
    }
    return joinPlatformPath(tmpDir, 'smm-test-folder')
}

/**
 * Create a media-folder fixture under `base` via `POST /api/writeFile`
 * (empty files for each entry in `folder.files`).
 * When `files` is empty, writes a tiny keep file so the directory is created.
 */
export async function createTestFolderViaBrowser(
    base: string,
    folder: { folderName: string; files: string[]; path?: string },
): Promise<string> {
    const folderPath = joinPlatformPath(base, folder.folderName)
    const files = folder.files.length > 0 ? folder.files : ['.smm-e2e-keep']
    for (const file of files) {
        const filePath = file
            .split(/[/\\]/)
            .filter(Boolean)
            .reduce((acc, segment) => joinPlatformPath(acc, segment), folderPath)
        await writeFileViaBrowser(filePath, '')
    }
    folder.path = folderPath
    return folderPath
}

/**
 * Create a fixture under `{tmpDir}/smm-test-folder` (or `base`) and emit
 * `ui.mediaFolderImported` via {@link importMediaFolder}.
 */
export async function createAndImportFolderViaBrowser(
    folder: {
        folderName: string
        files: string[]
        type: 'tvshow' | 'movie' | 'music'
        path?: string
    },
    traceId: string,
    base?: string,
): Promise<string> {
    const { importMediaFolder } = await import('test/actions/events')
    const root = base ?? (await resolveSmmTestFolderViaBrowser())
    const folderPath = await createTestFolderViaBrowser(root, folder)
    await importMediaFolder({
        type: folder.type,
        folderPathInPlatformFormat: folderPath,
        traceId,
    })
    folder.path = folderPath
    return folderPath
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

/**
 * Rename a file under the app allowlist by writing the new path and deleting the old one.
 * Content is not preserved (e2e fixtures use empty files).
 */
export async function renameFileViaBrowser(fromPath: string, toPath: string): Promise<void> {
    await writeFileViaBrowser(toPath, '')
    await deleteFileViaBrowser(fromPath)
}

export function buildDefaultUserConfig(initConfig?: Partial<UserConfig>): UserConfig {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY

    const userConfig: UserConfig = {
        applicationLanguage: 'en',
        tmdb: {},
        tvdb: {},
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
        // Avoid first-run AnonymousTelemetryConsentDialog blocking StatusBar clicks in e2e.
        anonymousTelemetryConsent: false,
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
