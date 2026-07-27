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

/**
 * yt-dlp DASH/HLS intermediates look like `title [id].f100026.mp4` before merge.
 * They must not count as completed downloads.
 */
export function isYtdlpFormatFragment(name: string): boolean {
    return /\.f\d+\./i.test(name)
}

/** True for a finished media file (not `.part`, not a yt-dlp format fragment). */
export function isCompletedVideoFileName(name: string): boolean {
    return (
        !name.includes(".part") &&
        !isYtdlpFormatFragment(name) &&
        VIDEO_FILE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
    )
}

/** True while yt-dlp still has `.part` or unmerged `.fNNNN.` format fragments. */
export function isIncompleteDownloadFileName(name: string): boolean {
    return name.includes(".part") || isYtdlpFormatFragment(name)
}

export function hasPartialDownloads(folderPath: string): boolean {
    return readdirSync(folderPath).some(isIncompleteDownloadFileName)
}

export function countVideoFilesInFolder(folderPath: string): number {
    return readdirSync(folderPath).filter(isCompletedVideoFileName).length
}

export async function hasPartialDownloadsViaBrowser(folderPath: string): Promise<boolean> {
    const names = await listFileNamesViaBrowser(folderPath)
    return names.some(isIncompleteDownloadFileName)
}

export async function countVideoFilesInFolderViaBrowser(folderPath: string): Promise<number> {
    const names = await listFileNamesViaBrowser(folderPath)
    return names.filter(isCompletedVideoFileName).length
}

/**
 * Waits until yt-dlp finishes (no `.part` / `.fNNNN.` intermediates) and the folder
 * has enough merged completed videos.
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
        `Expected at least ${minVideos} completed video file(s) with no in-progress downloads in folder`

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

export async function expectFolderHasFileMatching(
    folderPath: string,
    pattern: RegExp,
): Promise<string> {
    const names = await listFileNamesViaBrowser(folderPath)
    const match = names.find((name) => pattern.test(name))
    if (!match) {
        throw new Error(
            `Expected file matching ${pattern} in folder; found: ${names.join(", ") || "(empty)"}`,
        )
    }
    return match
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
        `Expected at least ${minVideos} completed video file(s) with no in-progress downloads in folder`

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
