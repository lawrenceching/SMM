import { useCallback, useEffect, useRef } from "react"
import { useConfig } from "@/hooks/userConfig"
import type { UIMediaMetadata } from "./types/UIMediaMetadata"
import Debug from "debug"
import { fetchDiscoverConfig } from "@/api/discover"
import { discoverConfigQueryKey } from "@/lib/appQueryKeys"
import { queryClient } from "@/lib/queryClient"
import { DvdGuideUrlInitializer } from "@/components/initialization/DvdGuideUrlInitializer"
import { UIMediaFolderStoreInitializer } from "@/components/initialization/UIMediaFolderStoreInitializer"
import { useTranslation } from "@/lib/i18n"
import { useStatusbarStore } from "@/stores/statusbarStore"

const debug = Debug("AppInitializer")

type InitStatus = "success" | "error"

// eslint-disable-next-line react-refresh/only-export-components
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
 * Schedules app initializers, aggregates their readiness, and drives
 * StatusBar / `_smm_status` feedback.
 */
export function AppInitializer() {
    const { reload } = useConfig()
    const { t } = useTranslation("components")
    const setInitializationMessage = useStatusbarStore((s) => s.setInitializationMessage)

    const bootstrapStartedRef = useRef(false)
    const pendingRef = useRef(new Set(["dvd-guide-url", "media-folder-store"]))
    const doneRef = useRef(false)
    const firstErrorRef = useRef<string | null>(null)

    const handleReady = useCallback(
        (id: string, status: InitStatus, errorMessage?: string) => {
            if (doneRef.current) return

            if (status === "error" && errorMessage && !firstErrorRef.current) {
                firstErrorRef.current = errorMessage
            }

            pendingRef.current.delete(id)

            if (pendingRef.current.size === 0) {
                doneRef.current = true
                if (firstErrorRef.current) {
                    window._smm_status = "error"
                    setInitializationMessage(
                        t("statusBar.messages.initializationError", {
                            message: firstErrorRef.current,
                        }),
                    )
                } else {
                    window._smm_status = "ready"
                    setInitializationMessage(null)
                }
            }
        },
        [t, setInitializationMessage],
    )

    const onDvdGuideReady = useCallback(
        (status: InitStatus, msg?: string) => handleReady("dvd-guide-url", status, msg),
        [handleReady],
    )
    const onMediaFolderStoreReady = useCallback(
        (status: InitStatus, msg?: string) => handleReady("media-folder-store", status, msg),
        [handleReady],
    )

    useEffect(() => {
        setInitializationMessage(t("statusBar.messages.initializing"))
        return () => {
            setInitializationMessage(null)
        }
    }, [t, setInitializationMessage])

    useEffect(() => {
        if (bootstrapStartedRef.current) {
            console.log(`[AppInitializer] already initialized, skipping`)
            return
        }

        console.log(`[AppInitializer] initializing app`)
        bootstrapStartedRef.current = true
        debug(`start to initialize app`)

        void queryClient.prefetchQuery({
            queryKey: discoverConfigQueryKey,
            queryFn: fetchDiscoverConfig,
        })

        reload({
            onSuccess: async () => {
                debug(`completed to initialize app`)
            },
        })
    }, [reload])

    return (
        <>
            <DvdGuideUrlInitializer onReady={onDvdGuideReady} />
            <UIMediaFolderStoreInitializer onReady={onMediaFolderStoreReady} />
        </>
    )
}
