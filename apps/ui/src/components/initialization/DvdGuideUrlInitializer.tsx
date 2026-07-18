import { useMount } from "react-use"
import { speedtest } from "@/api/speedtest"
import {
  DOWNLOAD_VIDEO_COOKIES_WIKI_URL,
  DOWNLOAD_VIDEO_COOKIES_GITCODE_URL,
} from "@core/download-video-cookie-platform"
import localStorages from "@/lib/localStorages"
import Debug from "debug"

const debug = Debug("DvdGuideUrlInitializer")

interface DvdGuideUrlInitializerProps {
  onReady: (status: "success" | "error", errorMessage?: string) => void
}

/**
 * At app startup, test both GitHub and GitCode guide URLs via the CLI speedtest API.
 * Store the faster URL in localStorage so the DVD "Guide & tutorial" link can
 * use the best available network route for the current user.
 *
 * Speedtest failures are non-fatal: the static DOWNLOAD_VIDEO_COOKIES_WIKI_URL
 * remains the fallback. This initializer always reports success to the scheduler.
 */
export function DvdGuideUrlInitializer({ onReady }: DvdGuideUrlInitializerProps) {
  useMount(() => {
    const urls = [DOWNLOAD_VIDEO_COOKIES_WIKI_URL, DOWNLOAD_VIDEO_COOKIES_GITCODE_URL]

    speedtest(urls)
      .then((response) => {
        debug("speedtest result: fastestUrl=%s", response.fastestUrl)
        localStorages.cookieGuideUrl = response.fastestUrl
        onReady("success")
      })
      .catch((error: unknown) => {
        debug("speedtest failed: %o", error)
        // Non-fatal — fallback to the static URL; always report success
        onReady("success")
      })
  })

  return null
}
