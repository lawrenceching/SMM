import { useCallback, useEffect, useRef } from "react"
import { useConfig } from "@/hooks/userConfig"
import Debug from "debug"
import { fetchDiscoverConfig } from "@/api/discover"
import { discoverConfigQueryKey } from "@/lib/appQueryKeys"
import { queryClient } from "@/lib/queryClient"
import { DvdGuideUrlInitializer } from "@/components/initialization/DvdGuideUrlInitializer"
import { UIMediaFolderStoreInitializer } from "@/components/initialization/UIMediaFolderStoreInitializer"
import { useStatusbarStore } from "@/stores/statusbarStore"

const debug = Debug("AppInitializer")

type InitStatus = "success" | "error"

/**
 * Schedules app initializers, aggregates their readiness, and drives
 * StatusBar / `_smm_status` feedback.
 */
export function AppInitializer() {
    const { reload } = useConfig()
    const setBootstrap = useStatusbarStore((s) => s.setBootstrap)

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
                    setBootstrap({ status: "error", message: firstErrorRef.current })
                } else {
                    window._smm_status = "ready"
                    setBootstrap({ status: "ready" })
                }
            }
        },
        [setBootstrap],
    )

    const onDvdGuideReady = useCallback(
        (status: InitStatus, msg?: string) => handleReady("dvd-guide-url", status, msg),
        [handleReady],
    )
    const onMediaFolderStoreReady = useCallback(
        (status: InitStatus, msg?: string) => handleReady("media-folder-store", status, msg),
        [handleReady],
    )

    // Reset phase on mount (page refresh / remount). StatusBar translates the
    // label from `bootstrap.status` — no translated string is stored.
    useEffect(() => {
        setBootstrap({ status: "initializing" })
    }, [setBootstrap])

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
