/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

/** Confirm button labels (en and zh-CN). */
const CONFIRM_LABELS = ['Confirm', '确认']

class TVShowPanel {
    /**
     * Get the episode table element
     */
    get episodeTable() {
        return $('[data-testid="tvshow-episode-table"]')
    }

    /**
     * Get the floating prompt container
     */
    get floatingPrompt() {
        return $('[data-testid="ai-rename-floating-prompt"]')
    }

    /**
     * Get the confirm button (supports en and zh-CN labels)
     */
    get confirmButton() {
        return this.getConfirmButton()
    }

    private async getConfirmButton() {
        for (const label of CONFIRM_LABELS) {
            const btn = await $('button=' + label)
            if (await btn.isExisting().catch(() => false)) {
                return btn
            }
        }
        return await $('button=Confirm')
    }

    /**
     * Check if the episode table is displayed
     */
    async isTableDisplayed(): Promise<boolean> {
        try {
            const table = await this.episodeTable
            return await table.isDisplayed()
        } catch {
            return false
        }
    }

    /**
     * Wait for the episode table to be displayed
     * @param timeout Timeout in milliseconds (default: 10000)
     */
    async waitForTable(timeout: number = 10000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return await this.isTableDisplayed()
        }, {
            timeout,
            timeoutMsg: `Episode table was not displayed after ${timeout}ms`
        })
    }

    /**
     * Check if the AI rename prompt (floating) is displayed
     */
    async isRenamePromptDisplayed(): Promise<boolean> {
        for (const label of CONFIRM_LABELS) {
            const btn = await $('button=' + label)
            if (await btn.isDisplayed().catch(() => false)) {
                return true
            }
        }
        return false
    }

    /**
     * Wait for the AI rename prompt to be displayed
     * @param timeout Timeout in milliseconds (default: 20000)
     */
    async waitForRenamePrompt(timeout: number = 20000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return await this.isRenamePromptDisplayed()
        }, {
            timeout,
            timeoutMsg: `AI rename prompt was not displayed after ${timeout}ms`
        })
    }

    /**
     * Get the checkbox element for a specific episode row by its ID (e.g., 'S01E02').
     * The checkbox is in the first column of the episode row.
     */
    async getEpisodeCheckbox(episodeId: string): Promise<WebdriverIO.Element> {
        // Find the table cell containing the episode ID
        const episodeIdCell = await $('td=' + episodeId)
        await episodeIdCell.waitForDisplayed({ timeout: 10000 })

        // Get the parent row
        const row = await episodeIdCell.parentElement()

        // Find the checkbox in the first cell of the row (the rename checkbox column)
        const checkboxCell = await row.$('td:first-child')
        return await checkboxCell.$('input[type="checkbox"]')
    }

    /**
     * Check if an episode's rename checkbox is checked
     * @param episodeId The episode ID (e.g., 'S01E02')
     */
    async isEpisodeCheckboxChecked(episodeId: string): Promise<boolean> {
        const checkbox = await this.getEpisodeCheckbox(episodeId)
        return await checkbox.isSelected()
    }

    /**
     * Uncheck the rename checkbox for a specific episode row by its ID.
     * @param episodeId The episode ID (e.g., 'S01E02')
     */
    async uncheckEpisode(episodeId: string): Promise<void> {
        const checkbox = await this.getEpisodeCheckbox(episodeId)
        await checkbox.waitForDisplayed({ timeout: 10000 })

        const isChecked = await checkbox.isSelected()
        if (isChecked) {
            await checkbox.click()
            console.log(`Unchecked rename checkbox for episode ${episodeId}`)
        }
    }

    /**
     * Check the rename checkbox for a specific episode row by its ID.
     * @param episodeId The episode ID (e.g., 'S01E02')
     */
    async checkEpisode(episodeId: string): Promise<void> {
        const checkbox = await this.getEpisodeCheckbox(episodeId)
        await checkbox.waitForDisplayed({ timeout: 10000 })

        const isChecked = await checkbox.isSelected()
        if (!isChecked) {
            await checkbox.click()
            console.log(`Checked rename checkbox for episode ${episodeId}`)
        }
    }

    /**
     * Toggle the rename checkbox for a specific episode row by its ID.
     * @param episodeId The episode ID (e.g., 'S01E02')
     */
    async toggleEpisodeCheckbox(episodeId: string): Promise<void> {
        const checkbox = await this.getEpisodeCheckbox(episodeId)
        await checkbox.waitForDisplayed({ timeout: 10000 })
        await checkbox.click()
    }

    /**
     * Click the Confirm button in the floating rename prompt.
     */
    async clickConfirm(): Promise<void> {
        await this.waitForRenamePrompt()

        let confirmBtn = await $('button=Confirm')
        if (!(await confirmBtn.isDisplayed().catch(() => false))) {
            confirmBtn = await $('button=确认')
        }
        await confirmBtn.waitForClickable({ timeout: 5000 })
        await confirmBtn.click()
    }

    /**
     * Uncheck multiple episodes at once.
     * @param episodeIds Array of episode IDs to uncheck
     */
    async uncheckEpisodes(episodeIds: string[]): Promise<void> {
        for (const episodeId of episodeIds) {
            await this.uncheckEpisode(episodeId)
        }
    }

    /**
     * Check multiple episodes at once.
     * @param episodeIds Array of episode IDs to check
     */
    async checkEpisodes(episodeIds: string[]): Promise<void> {
        for (const episodeId of episodeIds) {
            await this.checkEpisode(episodeId)
        }
    }
}

export default new TVShowPanel()
