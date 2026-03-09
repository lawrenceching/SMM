import { useMount } from "react-use"
import localStorages from "./lib/localStorages";
import { useConfig } from "./providers/config-provider";
import type { UserConfig } from "@core/types";
import type { UIMediaMetadata } from "./types/UIMediaMetadata";
import { useMediaMetadataActions } from "./actions/mediaMetadataActions";
import { useMediaMetadataStoreActions } from "./stores/mediaMetadataStore";
import { useRef } from "react";

export async function buildMediaMetadata(
  folders: string[],
  initializeMediaMetadata: (folderPath: string, type: "music-folder" | "tvshow-folder" | "movie-folder") => Promise<UIMediaMetadata>
) {
    const validFolders = folders.filter(f => f != null)

    // Initialize all folders in parallel
    const promises = validFolders.map(async (folder) => {
        // For now, default to movie-folder type - this could be improved with folder analysis
        return initializeMediaMetadata(folder, "movie-folder");
    });

    const initializedMetadata = await Promise.all(promises);
    return initializedMetadata;
}

/**
 * This component is used to initialize the app
 * 
 */
export function AppInitializer() {
    const { setMediaMetadatas, setSelectedIndex } = useMediaMetadataStoreActions();
    const { initializeMediaMetadata } = useMediaMetadataActions();
    const { reload } = useConfig();
    const initialized = useRef(false);

    useMount(() => {

        if(initialized.current) {
            console.log(`[AppInitializer] already initialized, skipping`)
            return;
        }

        console.log(`[AppInitializer] initializing app`)
        initialized.current = true;

        reload({
            onSuccess: async (userConfig: UserConfig) => {

                const now = Date.now()
                const initializedMetadata = await buildMediaMetadata(userConfig.folders, initializeMediaMetadata)

                // Set all initialized metadata in store
                setMediaMetadatas(initializedMetadata)

                const elapsed = Date.now() - now
                console.log(`[AppInitializer] took ${elapsed}ms to load all media metadatas`)

                const selectedFolderIndex = localStorages.selectedFolderIndex ?? 0;
                console.log(`[AppInitializer] initialize app with selected folder index: ${selectedFolderIndex}`)
                setSelectedIndex(selectedFolderIndex)
            }
        })

    })

    return (
        <>
        </>
    )
}