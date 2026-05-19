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

    get downloadEpisodesCheckbox() {
        return $('[data-testid="download-video-dialog-episodes-checkbox"]')
    }

    /** @deprecated Use {@link downloadEpisodesCheckbox} */
    get episodesCheckbox() {
        return this.downloadEpisodesCheckbox
    }

    get episodesList() {
        return $('[data-testid="download-video-dialog-episodes-list"]')
    }

    get episodesListItems() {
        return $$('[data-testid="download-video-dialog-episodes-list-item"]')
    }

    get getVideosCheckbox() {
        return $('[data-testid="download-video-dialog-get-videos-checkbox"]')
    }

    get collectionList() {
        return $('[data-testid="download-video-dialog-collection-list"]')
    }

    get collectionListItems() {
        return $$('[data-testid="download-video-dialog-collection-list-item"]')
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
        await input.clearValue()
        if (value.length > 0) {
            await browser.keys(value)
        }
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

    async setDownloadEpisodes(checked: boolean): Promise<void> {
        const checkbox = await this.downloadEpisodesCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
        }
    }

    async setGetVideos(checked: boolean): Promise<void> {
        const checkbox = await this.getVideosCheckbox
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
     * Waits until the collection list is shown and the item count is stable
     * (metadata fetch finished).
     */
    async waitForCollectionListLoaded(options?: {
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
                const list = await this.collectionList
                if (!(await list.isExisting().catch(() => false))) {
                    lastCount = -1
                    stablePolls = 0
                    return false
                }

                const items = await this.collectionListItems
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
                timeoutMsg: `[DownloadVideoDialog] Collection list did not stabilize (min ${minItems} items) within ${timeout}ms`,
            },
        )

        return resolvedCount
    }

    async uncheckCollectionExcept(keepIndices: number[]): Promise<void> {
        const list = await this.collectionList
        await list.waitForDisplayed({ timeout: 5000 })

        const keepIndexSet = new Set(keepIndices)
        const items = await this.collectionListItems
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
