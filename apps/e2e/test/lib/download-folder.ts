import { readdirSync } from "node:fs"
import { listFileNamesViaBrowser } from "./browser-fs"

const VIDEO_FILE_EXTENSIONS = [
    ".mp4",
    ".mkv",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".m4v",
] as const

function isCompletedVideoFileName(name: string): boolean {
    return (
        !name.includes(".part") &&
        VIDEO_FILE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
    )
}

export function hasPartialDownloads(folderPath: string): boolean {
    return readdirSync(folderPath).some((name) => name.includes(".part"))
}

export function countVideoFilesInFolder(folderPath: string): number {
    return readdirSync(folderPath).filter(isCompletedVideoFileName).length
}

export async function hasPartialDownloadsViaBrowser(folderPath: string): Promise<boolean> {
    const names = await listFileNamesViaBrowser(folderPath)
    return names.some((name) => name.includes(".part"))
}

export async function countVideoFilesInFolderViaBrowser(folderPath: string): Promise<number> {
    const names = await listFileNamesViaBrowser(folderPath)
    return names.filter(isCompletedVideoFileName).length
}

/**
 * Waits until yt-dlp finishes (no `.part` files) and the folder has enough completed videos.
 */
export async function waitForFolderVideosReady(
    folderPath: string,
    options?: {
        minVideos?: number
        timeout?: number
        interval?: number
        timeoutMsg?: string
    },
): Promise<void> {
    const minVideos = options?.minVideos ?? 1
    const timeout = options?.timeout ?? 90_000
    const interval = options?.interval ?? 1000
    const timeoutMsg =
        options?.timeoutMsg ??
        `Expected at least ${minVideos} completed video file(s) with no .part files in folder`

    try {
        await browser.waitUntil(
            async () => {
                if (hasPartialDownloads(folderPath)) {
                    return false
                }
                return countVideoFilesInFolder(folderPath) >= minVideos
            },
            { timeout, interval, timeoutMsg },
        )
    } catch (error) {
        const partial = hasPartialDownloads(folderPath)
        const count = countVideoFilesInFolder(folderPath)
        throw new Error(
            `${timeoutMsg}: found ${count} video(s), partialDownloads=${partial}`,
            { cause: error instanceof Error ? error : undefined },
        )
    }
}

/** Same as {@link waitForFolderVideosReady} but lists the folder via browser API. */
export async function waitForFolderVideosReadyViaBrowser(
    folderPath: string,
    options?: {
        minVideos?: number
        timeout?: number
        interval?: number
        timeoutMsg?: string
    },
): Promise<void> {
    const minVideos = options?.minVideos ?? 1
    const timeout = options?.timeout ?? 90_000
    const interval = options?.interval ?? 1000
    const timeoutMsg =
        options?.timeoutMsg ??
        `Expected at least ${minVideos} completed video file(s) with no .part files in folder`

    try {
        await browser.waitUntil(
            async () => {
                if (await hasPartialDownloadsViaBrowser(folderPath)) {
                    return false
                }
                return (await countVideoFilesInFolderViaBrowser(folderPath)) >= minVideos
            },
            { timeout, interval, timeoutMsg },
        )
    } catch (error) {
        const partial = await hasPartialDownloadsViaBrowser(folderPath)
        const count = await countVideoFilesInFolderViaBrowser(folderPath)
        throw new Error(
            `${timeoutMsg}: found ${count} video(s), partialDownloads=${partial}`,
            { cause: error instanceof Error ? error : undefined },
        )
    }
}
