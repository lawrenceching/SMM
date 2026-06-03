import { useMount } from "react-use"
import { speedtest } from "@/api/speedtest"
import {
  DOWNLOAD_VIDEO_COOKIES_WIKI_URL,
  DOWNLOAD_VIDEO_COOKIES_GITCODE_URL,
} from "@core/download-video-cookie-platform"
import localStorages from "@/lib/localStorages"
import Debug from "debug"

const debug = Debug("DvdGuideUrlInitializer")

/**
 * At app startup, test both GitHub and GitCode guide URLs via the CLI speedtest API.
 * Store the faster URL in localStorage so the DVD "Guide & tutorial" link can
 * use the best available network route for the current user.
 *
 * This runs silently — errors are logged but never surfaced to the user.
 * The existing DOWNLOAD_VIDEO_COOKIES_WIKI_URL is used as fallback when
 * localStorage has no value.
 */
export function DvdGuideUrlInitializer() {
  useMount(() => {
    const urls = [DOWNLOAD_VIDEO_COOKIES_WIKI_URL, DOWNLOAD_VIDEO_COOKIES_GITCODE_URL]

    speedtest(urls)
      .then((response) => {
        debug("speedtest result: fastestUrl=%s", response.fastestUrl)
        localStorages.cookieGuideUrl = response.fastestUrl
      })
      .catch((error: unknown) => {
        debug("speedtest failed: %o", error)
        // Silently ignore — fallback to the static URL is used
      })
  })

  return null
}
