import { useLatest, useMount } from "react-use"
import localStorages from "./lib/localStorages";
import { useMediaMetadata } from "./providers/media-metadata-provider";
import { useConfig } from "./providers/config-provider";
import { useEffect } from "react";
import { isNotNil } from "es-toolkit";
import { readMediaMetadataApi } from "./api/readMediaMatadata";

/**
 * This component is used to initialize the app
 * 
 */
export function AppInitializer() {
    const { setSelectedMediaMetadata, mediaMetadatas, addMediaMetadata } = useMediaMetadata()
    const { userConfig } = useConfig();
    const latestMediaMetadatas = useLatest(mediaMetadatas);

    useMount(() => {
        const selectedFolderIndex = localStorages.selectedFolderIndex ?? 0;
        console.log(`[AppInitializer] initialize app with selected folder index: ${selectedFolderIndex}`)
        setSelectedMediaMetadata(selectedFolderIndex)
    })

    useEffect(() => {
        (async () => {
            let folders = userConfig.folders
            folders = folders.filter(f => isNotNil(f))

            const mediaMetadatas = latestMediaMetadatas.current
            for(const folder of folders) {

                const found = mediaMetadatas.find(m => m.mediaFolderPath === folder)
                if(found !== undefined) {
                    continue
                }

                const resp = await readMediaMetadataApi(folder)
                if(resp.error) {
                    console.error(`[useAppStartUpEventHandler] Failed to read media metadata for folder: ${folder}`, resp.error)
                    continue
                }
                if(resp.data === undefined) {
                    console.error(`[useAppStartUpEventHandler] Failed to read media metadata for folder: ${folder}`, resp.error)
                    continue
                }
                const mm = resp.data
                addMediaMetadata({
                    ...mm,
                    status: 'ok',
                })
            }
        })()
    }, [userConfig]);

    return (
        <>
        </>
    )
}