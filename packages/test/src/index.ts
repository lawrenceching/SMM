/**
 * Test Utilities for Simple Media Manager
 *
 * This package provides shared testing utilities for SMM tests.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import type { MediaMetadata, UserConfig } from '@smm/core/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env.local') })

/**
 * Set up test media folders for import tests
 * This creates a temporary directory and copies test media files
 *
 * The test media files are expected to be located at `test/media` in the project root.
 *
 * Use this function only for tests that require actual media files
 */
export function setupTestMediaFolders(): {
    tmpDir: string,
    mediaDir: string,
} {
    const tmpDir = path.join(os.tmpdir(), 'smm-test-media')

    // 1. Create or recreate tmp folder
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
    fs.mkdirSync(tmpDir, { recursive: true })
    console.log(`Created tmp folder: ${tmpDir}`)

    // 2. Copy `test/media` to tmp folder (project root test/media)
    // Navigate from packages/test/src to project root: ../../../
    const testMediaPath = path.resolve(__dirname, '..', '..', '..', 'test', 'media')
    const targetMediaPath = path.join(tmpDir, 'media')

    // Recursive copy function
    function copyRecursiveSync(source: string, destination: string): void {
        const stats = fs.statSync(source)

        if (stats.isDirectory()) {
            // Create destination directory
            fs.mkdirSync(destination, { recursive: true })

            // Read all items in the directory
            const items = fs.readdirSync(source)

            // Copy each item recursively
            for (const item of items) {
                const sourcePath = path.join(source, item)
                const destPath = path.join(destination, item)
                copyRecursiveSync(sourcePath, destPath)
            }
        } else if (stats.isFile()) {
            // Copy file
            fs.copyFileSync(source, destination)
        }
    }

    copyRecursiveSync(testMediaPath, targetMediaPath)
    console.log(`Copied test/media to ${targetMediaPath}`)

    return {
        tmpDir,
        mediaDir: targetMediaPath,
    }
}

/**
 * Reset user config to default state
 * @param userConfigPath Path to the user config file. If undefined, will get it automatically via hello() API
 */
export async function resetUserConfig(userConfigPath?: string, initConfig?: Partial<UserConfig>): Promise<void> {
    if (!userConfigPath) {
        userConfigPath = await getUserConfigPath()
    }

    const deepseekApiKey = process.env.DEEPSEEK_API_KEY

    let userConfig: UserConfig = {
        applicationLanguage: 'en',
        tmdb: {},
        folders: [],
        renameRules: [],
        dryRun: false,
        ai: {
            deepseek: {
                baseURL: 'https://api.deepseek.com',
                model: 'deepseek-chat',
                apiKey: deepseekApiKey,
            },
            openAI: {},
            openrouter: {},
            glm: {},
            other: {},
        },
        selectedAI: 'DeepSeek',
        selectedTMDBIntance: 'public',
        selectedRenameRule: 'Plex(TvShow/Anime)',
        enableMcpServer: false,
        mcpHost: '127.0.0.1',
        mcpPort: 30001,
    }

    if(initConfig) {
        userConfig = { ...userConfig, ...initConfig }
    }
    
    fs.writeFileSync(userConfigPath, JSON.stringify(userConfig, null, 2), 'utf-8')
    console.log(`Reset user config at: ${userConfigPath}`)
}

export async function prepareMediaMetadata(mediaFolderPathInPosix: string, mediaMetadataFileNameInTestFolder: string): Promise<string> {
    const { appDataDir } = await hello()
    const mediaMetadataDir = path.join(appDataDir, 'metadata')
    if(!fs.existsSync(mediaMetadataDir)) {
        fs.mkdirSync(mediaMetadataDir, { recursive: true })
    }

    const srcMediaMetadataFilePath = path.resolve(__dirname, '..', '..', '..', 'test', 'configs', mediaMetadataFileNameInTestFolder)
    const filename = mediaFolderPathInPosix.replace(/[\/\\:?*|<>"]/g, '_')  + '.json'
    const dstMediaMetadataFilePath = path.join(mediaMetadataDir, filename)

    const text = fs.readFileSync(srcMediaMetadataFilePath, 'utf-8')
    const metadata = JSON.parse(text) as MediaMetadata
    metadata.mediaFolderPath = mediaFolderPathInPosix
    fs.writeFileSync(dstMediaMetadataFilePath, JSON.stringify(metadata, null, 4), 'utf-8')
    console.log(`Prepared media metadata file: ${dstMediaMetadataFilePath}`)
    return dstMediaMetadataFilePath
}

/**
 * Response from the hello API endpoint
 */
export interface HelloResponse {
    uptime: number
    version: string
    userDataDir: string
    appDataDir: string
}

/**
 * Call the hello API to get application info
 * @returns The hello API response containing user data directories
 */
export async function hello(): Promise<HelloResponse> {
    const response = await fetch('http://localhost:30000/api/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: 'hello',
        }),
    })
    const data = await response.json() as HelloResponse
    console.log('API response:', data)
    return data
}

export async function getAppDataDir(): Promise<string> {
    const data = await hello()
    return data.appDataDir
}

export async function getMetadataDir(): Promise<string> {
    const appDataDir = await getAppDataDir()
    return path.join(appDataDir, 'metadata')
}

/**
 * Remove the metadata directory if it exists.
 * This is useful to clean up metadata files from previous tests.
 * @returns The path to the metadata directory that was removed (or would be removed)
 */
export async function removeMetadataDir(): Promise<string | null> {
    const metadataDir = await getMetadataDir()
    if (fs.existsSync(metadataDir)) {
        fs.rmSync(metadataDir, { recursive: true, force: true })
        console.log(`Removed metadata directory: ${metadataDir}`)
        return metadataDir
    }
    return null
}

/**
 * Get the user config path by calling hello() API
 * @returns The path to the user config file (smm.json)
 */
export async function getUserConfigPath(): Promise<string> {
    const data = await hello()
    const userConfigPath = path.join(data.userDataDir, 'smm.json')
    return userConfigPath
}
