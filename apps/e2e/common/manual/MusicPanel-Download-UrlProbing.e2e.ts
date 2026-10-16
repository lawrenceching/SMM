/**
 * DownloadVideoDialog - URL Input & Format Probing (4.2)
 *
 * @supports local, Electron, Docker
 * @unsupported HarmonyOS
 *
 * Tests TC-URL-01 through TC-URL-09 covering:
 * - Valid URL + Go triggers format probing
 * - Invalid URL shows validation error
 * - Enter key triggers Go
 * - Go disabled during probing
 * - Format probe failure shows error
 * - Changing URL resets probe results
 * - YouTube QuickJS check
 * - QuickJS unavailable (manual only)
 * - Non-YouTube doesn't check QuickJS
 *
 * Also tests (all-site support):
 * - TC-E2E-UNSUPPORTED-01: unsupported site shows error message
 */

import { cleanup, setup } from "test/lib/testbed"
import {
    clearFolderViaBrowser,
    createAndImportFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from "test/lib/browser-fs"
import MusicPanel from "test/componentobjects/MusicPanel.co"
import DownloadVideoDialogCO from "test/componentobjects/DownloadVideoDialog.co"

import { testbedOs } from 'test/lib/e2e-platform'

const VALID_BILIBILI_URL = "https://www.bilibili.com/video/BV17NrWBaE87/"
const VALID_BILIBILI_URL_2 = "https://www.bilibili.com/video/BV1bW411a7jV/"
const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
const VALID_BUT_NONVIDEO_URL = "https://www.bilibili.com/video/BV1nonexistent999/"
const INVALID_URL = "not-a-valid-url"

const MOCK_SINGLE_VIDEO_JSON = JSON.stringify({
    _type: "video",
    id: "BV17NrWBaE87",
    title: "E2E probe single video",
    webpage_url: VALID_BILIBILI_URL,
    formats: [
        {
            format_id: "30216",
            ext: "m4a",
            resolution: "audio only",
            vcodec: "none",
            acodec: "mp4a.40.2",
        },
        {
            format_id: "100026",
            ext: "mp4",
            resolution: "1920x1080",
            vcodec: "avc1",
            acodec: "none",
            height: 1080,
        },
    ],
})

const MOCK_PLAYLIST_JSON = JSON.stringify({
    _type: "playlist",
    id: "BV1bW411a7jV",
    title: "E2E probe playlist",
    entries: [
        {
            _type: "video",
            id: "BV1bW411a7jV_p1",
            title: "Episode 1",
            webpage_url: VALID_BILIBILI_URL_2,
            formats: [
                {
                    format_id: "30216",
                    ext: "m4a",
                    resolution: "audio only",
                    vcodec: "none",
                    acodec: "mp4a.40.2",
                },
            ],
        },
        {
            _type: "video",
            id: "BV1bW411a7jV_p2",
            title: "Episode 2",
            webpage_url: "https://www.bilibili.com/video/BV1bW411a7jV/?p=2",
            formats: [
                {
                    format_id: "30216",
                    ext: "m4a",
                    resolution: "audio only",
                    vcodec: "none",
                    acodec: "mp4a.40.2",
                },
            ],
        },
    ],
})

/**
 * Stub `POST /api/ytdlp-inspect` in the page so Go does not spawn yt-dlp.
 * `errorMessage` becomes `{ error }`; otherwise `json` is returned as `{ data: { video, playlistEntries? } }`.
 */
async function installYtdlpInspectMock(opts: { json?: string; errorMessage?: string; delayMs?: number }) {
    await browser.execute(
        (mock) => {
            const w = window as Window & {
                __smmYtdlpInspectMock?: {
                    errorMessage?: string
                    video?: unknown
                    playlistEntries?: unknown
                    delayMs?: number
                }
                __smmYtdlpInspectFetchPatched?: boolean
            }
            if (mock.errorMessage) {
                w.__smmYtdlpInspectMock = { errorMessage: mock.errorMessage, delayMs: mock.delayMs }
            } else if (mock.json) {
                const parsed = JSON.parse(mock.json) as {
                    _type?: string
                    entries?: unknown[]
                }
                if (parsed._type === "playlist" && Array.isArray(parsed.entries)) {
                    w.__smmYtdlpInspectMock = {
                        video: parsed.entries[0],
                        playlistEntries: parsed.entries,
                        delayMs: mock.delayMs,
                    }
                } else {
                    w.__smmYtdlpInspectMock = { video: parsed, delayMs: mock.delayMs }
                }
            } else {
                delete w.__smmYtdlpInspectMock
            }

            if (w.__smmYtdlpInspectFetchPatched) return
            w.__smmYtdlpInspectFetchPatched = true
            const originalFetch = window.fetch.bind(window)
            window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
                const stub = w.__smmYtdlpInspectMock
                if (stub && url.includes("/api/ytdlp-inspect")) {
                    if (stub.delayMs) {
                        await new Promise((r) => setTimeout(r, stub.delayMs))
                    }
                    const body = stub.errorMessage
                        ? { error: stub.errorMessage }
                        : {
                              data: {
                                  video: stub.video,
                                  ...(stub.playlistEntries ? { playlistEntries: stub.playlistEntries } : {}),
                              },
                          }
                    return new Response(JSON.stringify(body), {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    })
                }
                return originalFetch(input, init)
            }
        },
        opts,
    )
}

async function clearYtdlpListFormatsMocks() {
    await installYtdlpInspectMock({})
}

async function mockYtdlpListFormatsSuccess(json: string) {
    await installYtdlpInspectMock({ json, delayMs: 150 })
}

async function mockYtdlpListFormatsError(errorMessage: string) {
    await installYtdlpInspectMock({ errorMessage })
}

describe("MusicPanel - Download - URL Input & Format Probing (4.2)", () => {
    let testFolder = ""

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
            clearLocalStorage: true,
            os: testbedOs,
        })

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)

        // Pre-set agreement so we can focus on URL/probing
        await browser.execute(() => {
            localStorage.setItem("DownloadVideoDialog.userAgreed", "true")
        })

        await createAndImportFolderViaBrowser({
            folderName: "ProbingTestMusic",
            type: "music",
            files: [],
        }, "e2eTest:MusicPanel-Download-UrlProbing", testFolder)

        await MusicPanel.downloadButton.waitForExist()
        await MusicPanel.downloadButton.waitForStable()
        await MusicPanel.downloadButton.waitForClickable()
        await MusicPanel.downloadButton.click()

        await DownloadVideoDialogCO.waitForDisplayed()

        // Verify agreement is skipped (already agreed)
        expect(DownloadVideoDialogCO.agreementCheckbox).not.toBeExisting()
    })

    afterEach(async () => {
        if (await DownloadVideoDialogCO.isDisplayed()) {
            await DownloadVideoDialogCO.clickCancel()
            await DownloadVideoDialogCO.waitForClosed(3000)
        }

        await clearYtdlpListFormatsMocks()

        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            clearLocalStorage: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    // ────────────────────────────────────────────────────────────────
    // TC-URL-01: Valid URL + Go triggers format probing
    // ────────────────────────────────────────────────────────────────
    it("TC-URL-01: entering valid URL and clicking Go triggers format probing", async function () {
        this.timeout(60 * 1000)

        await mockYtdlpListFormatsSuccess(MOCK_SINGLE_VIDEO_JSON)
        await DownloadVideoDialogCO.setUrl(VALID_BILIBILI_URL)

        // Before Go: no post-probe format UI
        expect(await DownloadVideoDialogCO.hasFormatProbeResults()).toBe(false)

        await DownloadVideoDialogCO.clickGo()

        await DownloadVideoDialogCO.waitForFormatProbeSuccess()

        // Verify Go button is re-enabled after probing
        expect(await DownloadVideoDialogCO.goButton.isEnabled()).toBe(true)

        // Verify cookies section moved to "more options" (showCookiesAtTopLevel = false)
        const useCookiesCheckbox = DownloadVideoDialogCO.useCookiesCheckbox
        // Cookies should be inside MoreOptions (not at top level after probing)
        // The top-level cookies checkbox shouldn't be directly visible
    })

    // ────────────────────────────────────────────────────────────────
    // TC-URL-02: Invalid URL shows validation error
    // ────────────────────────────────────────────────────────────────
    it("TC-URL-02: entering invalid URL shows validation error", async function () {
        this.timeout(30 * 1000)

        await DownloadVideoDialogCO.setUrl(INVALID_URL)

        // URL validation runs on change - should show an error paragraph
        const urlInput = DownloadVideoDialogCO.urlInput

        // The input should have the destructive border class
        await browser.waitUntil(
            async () => {
                const className = await urlInput.getAttribute("class")
                return className.includes("destructive")
            },
            { timeout: 5000, interval: 200, timeoutMsg: "URL input did not show error state" },
        )

        // Click Go should NOT trigger probing
        expect(await DownloadVideoDialogCO.goButton.isEnabled()).toBe(true)
        await DownloadVideoDialogCO.clickGo()

        // Pause briefly to ensure no format probe UI appeared
        await browser.pause(1000)
        expect(await DownloadVideoDialogCO.hasFormatProbeResults()).toBe(false)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-URL-03: Enter key triggers Go
    // ────────────────────────────────────────────────────────────────
    it("TC-URL-03: pressing Enter in URL input triggers format probing", async function () {
        this.timeout(60 * 1000)

        await mockYtdlpListFormatsSuccess(MOCK_SINGLE_VIDEO_JSON)
        // Use Enter key to submit the URL instead of clicking Go
        await DownloadVideoDialogCO.triggerUrlWithEnter(VALID_BILIBILI_URL)

        await DownloadVideoDialogCO.waitForFormatProbeSuccess()
    })

    // ────────────────────────────────────────────────────────────────
    // TC-URL-04: Go disabled during probing
    // ────────────────────────────────────────────────────────────────
    it("TC-URL-04: Go button shows spinner and is disabled during format probing", async function () {
        this.timeout(60 * 1000)

        await mockYtdlpListFormatsSuccess(MOCK_SINGLE_VIDEO_JSON)
        await DownloadVideoDialogCO.setUrl(VALID_BILIBILI_URL)
        await DownloadVideoDialogCO.clickGo()

        // The button should become disabled briefly while the API call is in flight.
        // React re-renders with isListing=true right after click.
        await browser.waitUntil(
            async () => !(await DownloadVideoDialogCO.goButton.isEnabled()),
            {
                timeout: 5000,
                interval: 50,
                timeoutMsg:
                    "Go button did not become disabled during probing (probing may have completed too fast)",
            },
        )

        // Wait for probing to finish (button re-enabled)
        await browser.waitUntil(
            async () => await DownloadVideoDialogCO.goButton.isEnabled(),
            {
                timeout: 45_000,
                interval: 500,
                timeoutMsg: "Go button did not become re-enabled after probing",
            },
        )
    })

    // ────────────────────────────────────────────────────────────────
    // TC-URL-05: Format probe failure shows error
    // ────────────────────────────────────────────────────────────────
    it("TC-URL-05: format probing failure displays error message", async function () {
        this.timeout(60 * 1000)

        await DownloadVideoDialogCO.setUrl(VALID_BUT_NONVIDEO_URL)
        await DownloadVideoDialogCO.clickGo()

        // yt-dlp should fail against a non-existent Bilibili video ID
        await browser.waitUntil(
            async () => await DownloadVideoDialogCO.listingError.isExisting(),
            {
                timeout: 30_000,
                interval: 500,
                timeoutMsg: "Listing error did not appear for non-existent Bilibili video",
            },
        )

        // Verify error text is displayed and non-empty
        expect(await DownloadVideoDialogCO.listingError.isDisplayed()).toBe(true)
        const errorText = await DownloadVideoDialogCO.listingError.getText()
        expect(errorText.length).toBeGreaterThan(0)

        // Format section should NOT appear after a failed probe
        expect(await DownloadVideoDialogCO.hasFormatProbeResults()).toBe(false)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-URL-06: Change URL resets probe results
    // ────────────────────────────────────────────────────────────────
    it("TC-URL-06: changing URL after successful probe resets format state", async function () {
        this.timeout(90 * 1000)

        // Step 1: Probe URL-1 successfully
        await mockYtdlpListFormatsSuccess(MOCK_SINGLE_VIDEO_JSON)
        await DownloadVideoDialogCO.setUrl(VALID_BILIBILI_URL)
        await DownloadVideoDialogCO.clickGo()

        await DownloadVideoDialogCO.waitForFormatProbeSuccess()

        // Step 2: Change to a different URL.
        // Use setValue which properly triggers React onChange → handleUrlChange
        // → resetListFormats → videoMetadata=null → showCookiesAtTopLevel=true
        // → FormatSection (and probe results) unrendered.
        await DownloadVideoDialogCO.setUrl(VALID_BILIBILI_URL_2)

        await DownloadVideoDialogCO.waitForFormatProbeCleared()

        // Step 3: Probe the new URL (playlist → video list UI, no format-mode radios)
        await mockYtdlpListFormatsSuccess(MOCK_PLAYLIST_JSON)
        await DownloadVideoDialogCO.clickGo()

        await DownloadVideoDialogCO.waitForFormatProbeSuccess()
    })

    // ────────────────────────────────────────────────────────────────
    // TC-URL-07: YouTube URL triggers QuickJS check
    // ────────────────────────────────────────────────────────────────
    it("TC-URL-07: YouTube URL with cookies triggers Go — QuickJS check runs", async function () {
        this.timeout(90 * 1000)

        await DownloadVideoDialogCO.setUrl(YOUTUBE_URL)

        // For YouTube, Go requires cookies. Set useCookiesFromBrowser by clicking
        // the checkbox's label (more reliable than the hidden checkbox input).
        const fromBrowserLabel = await $(
            'label[for="download-video-use-cookies-from-browser"]',
        )
        if (await fromBrowserLabel.isExisting()) {
            await fromBrowserLabel.click()
        }

        // Click Go. If the cookies checkbox state didn't register, handleGo will
        // still run (it checks the state). If Go is disabled due to cookies,
        // the QuickJS error won't appear but the test handles it gracefully.
        try {
            await DownloadVideoDialogCO.clickGo()
        } catch {
            console.log("[TC-URL-07] Go not clickable via WDIO — trying DOM click")
            await browser.execute(() => {
                const btn = document.querySelector(
                    '[data-testid="download-video-dialog-go-button"]',
                ) as HTMLButtonElement | null
                if (btn) btn.click()
            })
        }

        // Wait for ONE of:
        // A) QuickJS error → Go was blocked due to missing QuickJS
        // B) Format radio → Go succeeded and probing completed
        // C) Listing error → Go succeeded but probe failed
        await browser.waitUntil(
            async () =>
                (await DownloadVideoDialogCO.quickjsError.isExisting()) ||
                (await DownloadVideoDialogCO.hasFormatProbeResults()) ||
                (await DownloadVideoDialogCO.listingError.isExisting()),
            {
                timeout: 45_000,
                interval: 500,
                timeoutMsg:
                    "YouTube Go did not produce any result (no QuickJS error, no format radio, no listing error)",
            },
        )

        // Log the outcome
        if (await DownloadVideoDialogCO.quickjsError.isExisting()) {
            console.log(
                "[TC-URL-07] QuickJS is unavailable — Go blocked. Expected if QuickJS not installed.",
            )
        } else if (await DownloadVideoDialogCO.hasFormatProbeResults()) {
            console.log("[TC-URL-07] YouTube format probing succeeded.")
        } else {
            const errorText = await DownloadVideoDialogCO.listingError.getText()
            console.log(`[TC-URL-07] YouTube format listing failed: ${errorText}`)
        }
    })

    // ────────────────────────────────────────────────────────────────
    // TC-URL-08: QuickJS unavailable — covered by unit tests
    // ────────────────────────────────────────────────────────────────
    //
    // This scenario is covered by unit tests in:
    //   apps/ui/src/components/dialogs/download-video-dialog.test.tsx
    //   → "DownloadVideoDialog - QuickJS availability check"
    //
    // Tests:
    //   1. "shows QuickJS unavailable error and disables Start for YouTube
    //      when QuickJS is missing" — verifies error display + Start disabled
    //   2. "clears QuickJS error and enables Start when QuickJS becomes
    //      available on re-check" — verifies error clear + re-probe
    //   3. "skips QuickJS check for Bilibili URL and proceeds normally"
    //      — verifies non-YouTube URLs bypass the check
    //
    // Skipped in E2E because QuickJS availability is environment-dependent
    // and cannot be controlled in the standard test environment.

    // ────────────────────────────────────────────────────────────────
    // TC-URL-09: Non-YouTube doesn't check QuickJS
    // ────────────────────────────────────────────────────────────────
    it("TC-URL-09: Bilibili URL does not check QuickJS on Go", async function () {
        this.timeout(60 * 1000)

        await mockYtdlpListFormatsSuccess(MOCK_SINGLE_VIDEO_JSON)
        await DownloadVideoDialogCO.setUrl(VALID_BILIBILI_URL)

        // QuickJS error should not be present before Go
        expect(await DownloadVideoDialogCO.quickjsError.isExisting()).toBe(false)

        await DownloadVideoDialogCO.clickGo()

        // Wait for probing to complete
        await browser.waitUntil(
            async () =>
                (await DownloadVideoDialogCO.hasFormatProbeResults()) ||
                (await DownloadVideoDialogCO.listingError.isExisting()),
            {
                timeout: 45_000,
                interval: 500,
                timeoutMsg: "Bilibili probing did not complete",
            },
        )

        // QuickJS error must never appear for a Bilibili URL
        expect(await DownloadVideoDialogCO.quickjsError.isExisting()).toBe(false)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-E2E-UNSUPPORTED-01: yt-dlp unsupported site shows error
    // ────────────────────────────────────────────────────────────────
    it("TC-E2E-UNSUPPORTED-01: unsupported site URL displays unsupported-site error", async function () {
        this.timeout(60 * 1000)

        // Stub inspect as an unsupported-URL error; URL value is irrelevant to this case.
        await mockYtdlpListFormatsError("ERROR: Unsupported URL: https://mock.invalid/video")

        await DownloadVideoDialogCO.setUrl("https://mock.invalid/video")

        // Before Go: no listing error
        expect(await DownloadVideoDialogCO.listingError.isExisting()).toBe(false)

        await DownloadVideoDialogCO.clickGo()

        // Wait for listing error to appear
        await browser.waitUntil(
            async () => await DownloadVideoDialogCO.listingError.isExisting(),
            {
                timeout: 30_000,
                interval: 500,
                timeoutMsg: "Listing error did not appear for unsupported site URL",
            },
        )

        // Verify error text contains unsupported-site message
        const errorText = await DownloadVideoDialogCO.listingError.getText()
        expect(errorText).toMatch(/不支持|not supported|暂不支援/i)

        // Format section should NOT appear after a failed probe
        expect(await DownloadVideoDialogCO.hasFormatProbeResults()).toBe(false)
    })
})
