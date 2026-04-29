/// <reference types="@wdio/globals/types" />

import { browser } from "@wdio/globals"

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

    get episodesCheckbox() {
        return $('[data-testid="download-video-dialog-episodes-checkbox"]')
    }

    get episodesList() {
        return $('[data-testid="download-video-dialog-episodes-list"]')
    }

    get episodesListItems() {
        return $$('[data-testid="download-video-dialog-episodes-list-item"]')
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

    async setDownloadEpisodes(checked: boolean): Promise<void> {
        const checkbox = await this.episodesCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
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
