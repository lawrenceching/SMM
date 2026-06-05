import { useMount } from "react-use"
import { useConfig } from "@/hooks/userConfig";
import type { UIMediaMetadata } from "./types/UIMediaMetadata";
import { useRef } from "react";
import Debug from "debug"
import { fetchConvexSettings, getConvexSiteUrl } from "@/api/convexSettings"
import { convexSettingsQueryKey } from "@/lib/appQueryKeys"
import { queryClient } from "@/lib/queryClient"
import { DvdGuideUrlInitializer } from "@/components/initialization/DvdGuideUrlInitializer"
import { MediaDatabaseServiceDiscovery } from "@/components/initialization/MediaDatabaseServiceDiscovery"
const debug = Debug("AppInitializer")

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
    const { reload } = useConfig();
    const initialized = useRef(false);

    useMount(() => {

        if(initialized.current) {
            console.log(`[AppInitializer] already initialized, skipping`)
            return;
        }

        console.log(`[AppInitializer] initializing app`)
        initialized.current = true;

        debug(`start to initialize app`)

        if (getConvexSiteUrl()) {
            void queryClient.prefetchQuery({
                queryKey: convexSettingsQueryKey,
                queryFn: fetchConvexSettings,
            })
        }

        reload({
            onSuccess: async () => {
                // TODO: recover UI state
                debug(`completed to initialize app`)
            }
        })

    })

    return (
        <>
            <DvdGuideUrlInitializer />
            <MediaDatabaseServiceDiscovery />
        </>
    )
}