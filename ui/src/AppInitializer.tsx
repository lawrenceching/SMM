import { useLatest, useMount } from "react-use"
import localStorages from "./lib/localStorages";
import { useMediaMetadata } from "./providers/media-metadata-provider";
import { useConfig } from "./providers/config-provider";
import { useEffect } from "react";
import { isNotNil } from "es-toolkit";
import { readMediaMetadataApi } from "./api/readMediaMatadata";
import { Path } from "@core/path";
import type { UserConfig } from "@core/types";
import type { UIMediaMetadata } from "./types/UIMediaMetadata";
import { listFiles } from "./api/listFiles";


export async function buildMediaMetadata(folders: string[], setMediaMetadatas: (mediaMetadatas: UIMediaMetadata[]) => void) {

    const validFolders = folders.filter(isNotNil)

    const mediaMetadatas: UIMediaMetadata[] = validFolders
        .map(folder => {
            return {
                mediaFolderPath: Path.posix(folder),
                status: 'loading',
            }
        })

    // Update UI to display the folders in Sidebar
    setMediaMetadatas(mediaMetadatas);

    const promises = mediaMetadatas.map(async (mm: UIMediaMetadata, index: number) => {

        try {

            const resp = await readMediaMetadataApi(validFolders[index])
            if (resp.error) {
                console.error(`[buildMediaMetadata] Failed to read media metadata for folder: ${mm.mediaFolderPath}`, resp.error)
                return
            }
            if (resp.data === undefined) {
                console.error(`[buildMediaMetadata] Failed to read media metadata for folder: ${mm.mediaFolderPath}`, resp.error)
                return
            }

            mediaMetadatas[index] = {
                ...resp.data,
                status: 'loading',
            }
            console.log(`[AppInitializer] loaded media metadata for folder: ${validFolders[index]}`)

            setMediaMetadatas([...mediaMetadatas])

            const listFilesResp = await listFiles({ path: validFolders[index], recursively: true, onlyFiles: true })
            if (listFilesResp.error) {
                console.error(`[buildMediaMetadata] Failed to list files for folder: ${mm.mediaFolderPath}`, listFilesResp.error)
                return
            }
            if (listFilesResp.data === undefined) {
                console.error(`[buildMediaMetadata] Failed to list files for folder: ${mm.mediaFolderPath}`, listFilesResp.error)
                return
            }

            mediaMetadatas[index] = {
                ...mediaMetadatas[index],
                files: listFilesResp.data.items.map(item => Path.posix(item.path)),
                status: 'ok',
            }
            console.log(`[AppInitializer] loaded files for folder: ${validFolders[index]}`)
            setMediaMetadatas([...mediaMetadatas])

        } catch (error) {
            console.error(`[buildMediaMetadata] Failed to read media metadata for folder: ${mm.mediaFolderPath}`, error)
            mediaMetadatas[index] = {
                ...mm,
                status: 'error_loading_metadata',
            }
            setMediaMetadatas([...mediaMetadatas])
            return
        }

    })

    await Promise.all(promises)

}

/**
 * This component is used to initialize the app
 * 
 */
export function AppInitializer() {
    const { setSelectedMediaMetadata, setMediaMetadatas } = useMediaMetadata()
    const { reload } = useConfig();

    useMount(() => {

        reload({
            onSuccess: async (userConfig: UserConfig) => {

                const now = Date.now()
                await buildMediaMetadata(userConfig.folders, setMediaMetadatas)
                const elapsed = Date.now() - now
                console.log(`[AppInitializer] took ${elapsed}ms to load all media metadatas`)

                const selectedFolderIndex = localStorages.selectedFolderIndex ?? 0;
                console.log(`[AppInitializer] initialize app with selected folder index: ${selectedFolderIndex}`)
                setSelectedMediaMetadata(selectedFolderIndex)
            }
        })

    })

    return (
        <>
        </>
    )
}