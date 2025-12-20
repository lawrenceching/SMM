import { shell } from "electron";

/**
 * @param path Path in platform format
 * @returns 
 */
export async function openInFileManager(path: string) {
    try {
        await shell.showItemInFolder(path)
        console.log(`[OpenInFileManager] Opened folder: ${path}`)
        return { success: true }
    } catch (error) {
        console.error('Error opening folder in system file manager:', error)
        return { success: false, error: error }
    }
}