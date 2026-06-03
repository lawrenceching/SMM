/// <reference types="@wdio/globals/types" />

import { browser } from "@wdio/globals"

export type VideoFormatPresetId = "default" | "best" | "1080p" | "720p" | "audio"
export type CookiesBrowserId = "chrome" | "edge" | "firefox"

const OPEN_RADIX_SELECT_CONTENT = '[data-slot="select-content"][data-state="open"]'

/** Visible labels from `apps/ui/public/locales/{en,zh-CN}/dialogs.json`. */
const FORMAT_OPTION_LABELS: Record<VideoFormatPresetId, readonly string[]> = {
    default: ["Default (automatic)", "默认（自动）"],
    best: ["Best quality", "最佳画质"],
    "1080p": ["1080p"],
    "720p": ["720p"],
    audio: ["Audio only", "仅音频"],
}

const BROWSER_OPTION_LABELS: Record<CookiesBrowserId, readonly string[]> = {
    chrome: ["Chrome"],
    edge: ["Edge"],
    firefox: ["Firefox"],
}

class DownloadVideoDialogCO {
    get dialog() {
        return $('[data-testid="download-video-dialog"]')
    }

    get agreementCheckbox() {
        return $('[data-testid="download-video-dialog-agreement-checkbox"]')
    }

    get urlInput() {
        return $('[data-testid="download-video-dialog-url-input"]')
    }

    get goButton() {
        return $('[data-testid="download-video-dialog-go-button"]')
    }

    get listingError() {
        return $('[data-testid="download-video-dialog-listing-error"]')
    }

    get quickjsError() {
        return $('[data-testid="download-video-dialog-quickjs-unavailable"]')
    }

    get formatModePresetRadio() {
        return $('[data-testid="download-video-dialog-format-mode-preset"]')
    }

    get formatModeCodeRadio() {
        return $('[data-testid="download-video-dialog-format-mode-code"]')
    }

    get useCookiesCheckbox() {
        return $('[data-testid="download-video-dialog-use-cookies-checkbox"]')
    }

    get configureButton() {
        return $('[data-testid="download-video-dialog-cookies-button"]')
    }

    get cookiesTextDialog() {
        return $('[data-testid="text-dialog"]')
    }

    get cookiesTextDialogInput() {
        return $('[data-testid="text-dialog-input"]')
    }

    get cookiesTextDialogConfirm() {
        return $('[data-testid="text-dialog-confirm"]')
    }

    get fromBrowserCheckbox() {
        return $('[data-testid="download-video-dialog-use-cookies-from-browser-checkbox"]')
    }

    get formatSelectTrigger() {
        return $('[data-testid="download-video-dialog-format-select"]')
    }

    get browserSelectTrigger() {
        return $('[data-testid="download-video-dialog-cookies-browser-select"]')
    }

    get moreOptionsCheckbox() {
        return $('[data-testid="download-video-dialog-more-options-checkbox"]')
    }

    get writeThumbnailCheckbox() {
        return $('[data-testid="download-video-dialog-write-thumbnail-checkbox"]')
    }

    get embedThumbnailCheckbox() {
        return $('[data-testid="download-video-dialog-embed-thumbnail-checkbox"]')
    }

    get embedMetadataCheckbox() {
        return $('[data-testid="download-video-dialog-embed-metadata-checkbox"]')
    }

    get listingLogButton() {
        return $('[data-testid="download-video-dialog-listing-log-button"]')
    }

    get videoList() {
        return $('[data-testid="download-video-dialog-video-list"]')
    }

    get episodesList() {
        return $('[data-testid="download-video-dialog-episodes-list"]')
    }

    get episodesListItems() {
        return $$('[data-testid="download-video-dialog-episodes-list-item"]')
    }

    // --- New element getters ---

    // Cookies section
    get cookiesSection() {
        return $('[data-testid="download-video-dialog-cookies-section"]')
    }

    get cookiesHint() {
        return $('[data-testid="download-video-dialog-cookies-hint"]')
    }

    get cookiesTutorialLink() {
        return $('[data-testid="download-video-dialog-cookies-tutorial-link"]')
    }

    get cookiesEmptyHint() {
        return $('[data-testid="download-video-dialog-cookies-empty-hint"]')
    }

    get format1080pAuthHint() {
        return $('[data-testid="download-video-dialog-1080p-auth-hint"]')
    }

    // Format code select
    get formatCodeSelectTrigger() {
        return $('[data-testid="download-video-dialog-format-code-select"]')
    }

    get supplementaryFormatCodeSelectTrigger() {
        return $('[data-testid="download-video-dialog-supplementary-format-code-select"]')
    }

    // JS Runtime
    get jsRuntimeCheckbox() {
        return $('[data-testid="download-video-dialog-use-js-runtime-checkbox"]')
    }

    get jsRuntimeSelectTrigger() {
        return $('[data-testid="download-video-dialog-js-runtime-select"]')
    }

    get folderInput() {
        return $('[data-testid="download-video-dialog-folder-input"]')
    }

    get folderPickerButton() {
        return $('[data-testid="download-video-dialog-folder-picker"]')
    }

    get cancelButton() {
        return $('[data-testid="download-video-dialog-cancel"]')
    }

    get startButton() {
        return $('[data-testid="download-video-dialog-start"]')
    }

    async isDisplayed(): Promise<boolean> {
        try {
            return await this.dialog.isDisplayed()
        } catch {
            return false
        }
    }

    async waitForDisplayed(timeout: number = 5000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return await this.isDisplayed()
        }, {
            timeout,
            timeoutMsg: `DownloadVideoDialog was not displayed after ${timeout}ms`,
        })
    }

    async waitForClosed(timeout: number = 5000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return !(await this.isDisplayed())
        }, {
            timeout,
            timeoutMsg: `DownloadVideoDialog was not closed after ${timeout}ms`,
        })
    }

    async setAgreement(checked: boolean): Promise<void> {
        const checkbox = await this.agreementCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
        }
    }

    async setUrl(value: string): Promise<void> {
        const input = await this.urlInput
        await input.waitForDisplayed({ timeout: 5000 })
        await input.click()
        // Use addValue to properly trigger React controlled input events
        await input.setValue(value)
    }

    async clickGo(): Promise<void> {
        const button = await this.goButton
        await button.waitForClickable({ timeout: 5000 })
        await button.click()
    }

    async triggerUrlWithEnter(value: string): Promise<void> {
        const input = await this.urlInput
        await input.waitForDisplayed({ timeout: 5000 })
        await input.click()
        await input.setValue(value)
        // Press Enter to trigger Go
        await browser.keys(['Enter'])
    }

    async setUseCookies(checked: boolean): Promise<void> {
        const checkbox = await this.useCookiesCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
        }
    }

    async setUseCookiesFromBrowser(checked: boolean): Promise<void> {
        const checkbox = await this.fromBrowserCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
        }
    }

    async clickConfigureCookies(): Promise<void> {
        const button = await this.configureButton
        await button.waitForClickable({ timeout: 5000 })
        await button.click()
    }

    /**
     * Opens the cookies editor (Configure), enters Netscape cookie text, and confirms.
     */
    async setCookies(text: string): Promise<void> {
        await this.clickConfigureCookies()

        const dialog = await this.cookiesTextDialog
        await dialog.waitForDisplayed({ timeout: 5000 })

        const input = await this.cookiesTextDialogInput
        await input.waitForDisplayed({ timeout: 5000 })
        await input.click()
        await input.clearValue()
        if (text.length > 0) {
            await input.setValue(text)
        }

        const confirm = await this.cookiesTextDialogConfirm
        await confirm.waitForClickable({ timeout: 5000 })
        await confirm.click()

        await browser.waitUntil(async () => !(await dialog.isDisplayed()), {
            timeout: 5000,
            timeoutMsg: "Cookies text dialog did not close after confirm",
        })
    }

    async setMoreOptions(checked: boolean): Promise<void> {
        const checkbox = await this.moreOptionsCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
        }
    }

    async setWriteThumbnail(checked: boolean): Promise<void> {
        const checkbox = await this.writeThumbnailCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
        }
    }

    async setEmbedThumbnail(checked: boolean): Promise<void> {
        const checkbox = await this.embedThumbnailCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
        }
    }

    async setEmbedMetadata(checked: boolean): Promise<void> {
        const checkbox = await this.embedMetadataCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
        }
    }

    /**
     * Radix Select renders options in a portal; WebdriverIO element clicks are flaky.
     * Match by `data-value` or visible label, then click inside the browser context.
     */
    private async selectRadixOption(
        trigger: ChainablePromiseElement,
        value: string,
        visibleLabels: readonly string[],
    ): Promise<void> {
        await trigger.waitForDisplayed({ timeout: 5000 })
        await trigger.scrollIntoView()
        await trigger.click()

        await browser.waitUntil(
            async () =>
                (await browser.executeScript(
                    `return !!document.querySelector(arguments[0])`,
                    [OPEN_RADIX_SELECT_CONTENT],
                )) as boolean,
            {
                timeout: 5000,
                timeoutMsg: "Radix select dropdown did not open",
            },
        )

        const labelHint = visibleLabels[0] ?? value
        const clicked = (await browser.executeScript(
            `
            const content = document.querySelector(arguments[0]);
            if (!content) return false;
            const optionValue = arguments[1];
            const labels = arguments[2];
            const items = content.querySelectorAll('[data-slot="select-item"]');
            for (const item of items) {
              const dataValue = item.getAttribute('data-value');
              const text = (item.textContent || '').replace(/\\s+/g, ' ').trim();
              const matchesValue = dataValue === optionValue;
              const matchesLabel = labels.some(function (label) {
                return text === label || text.includes(label) || (label.length > 0 && label.includes(text));
              });
              if (matchesValue || matchesLabel) {
                item.click();
                return true;
              }
            }
            return false;
            `,
            [OPEN_RADIX_SELECT_CONTENT, value, [...visibleLabels]],
        )) as boolean

        if (!clicked) {
            throw new Error(
                `Radix select option not found: value="${value}" labels=${visibleLabels.join(", ")}`,
            )
        }

        await browser.waitUntil(
            async () =>
                !(await browser.executeScript(
                    `return !!document.querySelector(arguments[0])`,
                    [OPEN_RADIX_SELECT_CONTENT],
                )) as boolean,
            {
                timeout: 5000,
                timeoutMsg: `Radix select option "${labelHint}" did not close the dropdown`,
            },
        )
    }

    /**
     * Selects a yt-dlp format preset. Requires agreement checked and a valid URL
     * (format select is only rendered when both are satisfied).
     */
    async selectVideoFormat(presetId: VideoFormatPresetId): Promise<void> {
        await this.selectRadixOption(
            await this.formatSelectTrigger,
            presetId,
            FORMAT_OPTION_LABELS[presetId],
        )
    }

    /**
     * Enables "cookies from browser" and selects the browser profile.
     */
    async selectBrowser(browserId: CookiesBrowserId): Promise<void> {
        await this.setUseCookiesFromBrowser(true)
        await this.selectRadixOption(
            await this.browserSelectTrigger,
            browserId,
            BROWSER_OPTION_LABELS[browserId],
        )
    }

    /**
     * Waits until the video (episodes) list is shown and the item count is stable
     * (metadata fetch finished). Replaces the deprecated waitForCollectionListLoaded.
     */
    async waitForVideoListLoaded(options?: {
        minItems?: number
        timeout?: number
        interval?: number
    }): Promise<number> {
        const minItems = options?.minItems ?? 1
        const timeout = options?.timeout ?? 60_000
        const interval = options?.interval ?? 1000
        let lastCount = -1
        let stablePolls = 0
        let resolvedCount = 0

        await browser.waitUntil(
            async () => {
                const list = await this.episodesList
                if (!(await list.isExisting().catch(() => false))) {
                    lastCount = -1
                    stablePolls = 0
                    return false
                }

                const items = await this.episodesListItems
                const count = await items.length
                if (count < minItems) {
                    lastCount = -1
                    stablePolls = 0
                    return false
                }

                if (count === lastCount) {
                    stablePolls += 1
                } else {
                    stablePolls = 0
                    lastCount = count
                }

                if (stablePolls >= 1) {
                    resolvedCount = count
                    return true
                }
                return false
            },
            {
                timeout,
                interval,
                timeoutMsg: `[DownloadVideoDialog] Video list did not stabilize (min ${minItems} items) within ${timeout}ms`,
            },
        )

        return resolvedCount
    }

    async uncheckEpisodesExcept(keepIndices: number[]): Promise<void> {
        const list = await this.episodesList
        await list.waitForDisplayed({ timeout: 5000 })

        const keepIndexSet = new Set(keepIndices)
        const items = await this.episodesListItems
        const itemCount = await items.length

        for (let index = 0; index < itemCount; index += 1) {
            if (keepIndexSet.has(index)) {
                continue
            }

            const item = items[index]
            if (!item) {
                continue
            }
            const checkbox = await item.$('input[type="checkbox"]')
            await checkbox.waitForExist({ timeout: 5000 })

            if (await checkbox.isSelected()) {
                await checkbox.click()
            }
        }
    }

    // --- New methods ---

    /**
     * Clicks the "View Log" button next to the listing error.
     */
    async clickListingLogButton(): Promise<void> {
        const button = await this.listingLogButton
        await button.waitForClickable({ timeout: 5000 })
        await button.click()
    }

    /**
     * Selects a format code from the format code select dropdown.
     * If currently in preset mode, switches to format-code mode first.
     */
    async selectFormatCode(formatCodeId: string): Promise<void> {
        // Switch to format-code mode if currently in preset mode
        const presetRadio = await this.formatModePresetRadio
        if (await presetRadio.isExisting()) {
            const currentMode = await browser.execute(
                () => document.querySelector<HTMLInputElement>('[data-testid="download-video-dialog-format-mode-preset"]')?.checked,
            )
            if (currentMode) {
                const codeRadio = await this.formatModeCodeRadio
                await codeRadio.waitForClickable({ timeout: 5000 })
                await codeRadio.click()
            }
        }

        await this.selectRadixOption(
            await this.formatCodeSelectTrigger,
            formatCodeId,
            [],
        )
    }

    /**
     * Selects a supplementary format code (when audio-only or video-only is selected).
     */
    async selectSupplementaryFormatCode(formatCodeId: string): Promise<void> {
        await this.selectRadixOption(
            await this.supplementaryFormatCodeSelectTrigger,
            formatCodeId,
            [],
        )
    }

    /**
     * Sets the "Use JavaScript Runtime" checkbox.
     */
    async setUseJsRuntime(checked: boolean): Promise<void> {
        const checkbox = await this.jsRuntimeCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
        }
    }

    /**
     * Selects a JS runtime from the dropdown (only available when useJsRuntime is checked).
     */
    async selectJsRuntime(runtimeId: string): Promise<void> {
        await this.selectRadixOption(
            await this.jsRuntimeSelectTrigger,
            runtimeId,
            [],
        )
    }

    async dumpStartButtonDebugInfo(): Promise<void> {
        const button = await this.startButton
        const urlInput = await this.urlInput
        const folderInput = await this.folderInput
        const items = await this.episodesListItems
        const itemCount = await items.length

        let selectedCount = 0
        for (let index = 0; index < itemCount; index += 1) {
            const item = items[index]
            if (!item) continue
            const checkbox = await item.$('input[type="checkbox"]')
            if (await checkbox.isSelected()) {
                selectedCount += 1
            }
        }

        const debugInfo = {
            startButton: {
                displayed: await button.isDisplayed(),
                enabled: await button.isEnabled(),
                clickable: await button.isClickable(),
                disabledAttr: await button.getAttribute("disabled"),
                text: await button.getText(),
            },
            url: {
                value: await urlInput.getValue(),
            },
            folder: {
                value: await folderInput.getValue(),
            },
            episodes: {
                total: itemCount,
                selected: selectedCount,
            },
        }

        // Keep this log structured so test terminal output is easy to parse.
        console.log("[DownloadVideoDialogCO] Start button debug info:", JSON.stringify(debugInfo, null, 2))
    }

    async clickStart(): Promise<void> {
        const button = await this.startButton
        try {
            await button.waitForClickable({ timeout: 5000 })
            await button.click()
            return
        } catch (error) {
            await this.dumpStartButtonDebugInfo()
            throw error
        }
    }

    async clickCancel(): Promise<void> {
        const button = await this.cancelButton
        await button.waitForClickable({ timeout: 5000 })
        await button.click()
    }
}

export default new DownloadVideoDialogCO()
