#!/bin/env bun

import os from 'os'
import path from 'path'
import fs from 'fs'
import { Path } from '../../core/path'

const env = await Bun.file(".env.json").json()

// 1. Prepare the tmp folder
const tmpDir = path.join(os.tmpdir(), 'smm-test-media')
// Clean up existing folder if it exists for idempotency
if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
}
fs.mkdirSync(tmpDir, { recursive: true })
console.log(`Created tmp folder: ${tmpDir}`)

// 2. Copy "test/media" to tmp folder
const testMediaPath = path.join(import.meta.dir, '..', 'media')
const targetMediaPath = path.join(tmpDir, 'media')

// Recursive copy function
async function copyRecursive(source: string, destination: string): Promise<void> {
    const stats = await fs.promises.stat(source)
    
    if (stats.isDirectory()) {
        // Create destination directory
        await fs.promises.mkdir(destination, { recursive: true })
        
        // Read all items in the directory
        const items = await fs.promises.readdir(source)
        
        // Copy each item recursively
        for (const item of items) {
            const sourcePath = path.join(source, item)
            const destPath = path.join(destination, item)
            await copyRecursive(sourcePath, destPath)
        }
    } else if (stats.isFile()) {
        // Copy file
        await fs.promises.copyFile(source, destination)
    }
}

await copyRecursive(testMediaPath, targetMediaPath)
console.log(`Copied test/media to ${targetMediaPath}`)

const userConfig: {
    applicationLanguage: string;
    folders: string[];
    ai: {
        deepseek: {
            baseURL: string;
            apiKey: string;
            model: string;
        };
    };
    selectedAI: string;
} = {
    applicationLanguage: "zh-CN",
    folders: [],
    ai: {
        deepseek: {
            baseURL: "https://api.deepseek.com",
            apiKey: env["deepseekApiKey"],
            model: "deepseek-chat"
        }
    },
    selectedAI: "DeepSeek"
}


const appDataDir = "C:\\Users\\lawrence\\AppData\\Roaming\\SMM"

// 3. Add test folder "[测试用字幕组] キルミーベイベー" path to userConfig
const testFolderPath = path.join(targetMediaPath, '[测试用字幕组] キルミーベイベー')
// Verify the folder exists before adding
// path.join() already returns platform-specific paths, so use it directly
if (fs.existsSync(testFolderPath)) {
    userConfig.folders.push(testFolderPath)
    console.log(`Added test folder to config: ${testFolderPath}`)
} else {
    console.warn(`Warning: Test folder does not exist at ${testFolderPath}`)
}

await Bun.write("C:\\Users\\lawrence\\AppData\\Roaming\\SMM\\smm.json", JSON.stringify(userConfig, null, 4))
console.log(`Prepare smm.json: ` + JSON.stringify(userConfig, null, 4))



// 4. Write media metadata to cache
const mediaMetadata = {
    mediaFolderPath: testFolderPath,
    type: "tvshow-folder",
}
const testFolderPathInPosix = Path.posix(testFolderPath)
const mediaMetadataFileName = testFolderPathInPosix.replace(/[\/\\:?*|<>"]/g, '_')
const mediaMetadataFilePath = path.join(appDataDir, 'metadata', mediaMetadataFileName + '.json')
await Bun.write(mediaMetadataFilePath, JSON.stringify(mediaMetadata, null, 4))
console.log(`Prepared media metadata file: ${mediaMetadataFilePath}`)

console.log("Setup completed")
export {}