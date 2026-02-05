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
import { loadUIMediaMetadata } from "./lib/mediaMetadataUtils";


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

    const promises = mediaMetadatas.map(async (_: UIMediaMetadata, index: number) => {

        await loadUIMediaMetadata(validFolders[index], {
            readMediaMetadataApi: readMediaMetadataApi,
            listFilesApi: listFiles,
            callback: (mm: UIMediaMetadata) => {
                mediaMetadatas[index] = {...mm};
                setMediaMetadatas([...mediaMetadatas])
            }
        })

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