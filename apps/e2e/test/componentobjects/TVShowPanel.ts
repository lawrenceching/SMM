/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

/** Confirm button labels (en and zh-CN). */
const CONFIRM_LABELS = ['Confirm', '确认']

export interface TvShowEpisodeTableRowDivider {
    id: string,
    type: 'divider',
}

export interface TvShowEpisodeTableSimpleRow {
    id: string,
    type: string,
    checkbox: boolean,
    videoFile: string,
    thumbnail: string,
    nfo: string,
    subtitle: string,
}

export type TvShowEpisodeTableRow = TvShowEpisodeTableRowDivider | TvShowEpisodeTableSimpleRow

export interface TvShowPanelState {
    title: string,
    recognizeButton: {
        disabled: boolean,
    },
    renameButton: {
        disabled: boolean,
    },
    scrapeButton: {
        disabled: boolean,
    },
    table: TvShowEpisodeTableRow[]
}

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

    async waitForDisplay(timeout: number = 10000): Promise<boolean> {
        return await this.waitForTable(timeout)
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

    /**
     * Get the current state of the TV show panel
     */
    async getState(): Promise<TvShowPanelState> {
        const state: TvShowPanelState = {
            title: '',
            recognizeButton: { disabled: true },
            renameButton: { disabled: true },
            scrapeButton: { disabled: true },
            table: []
        }

        try {
            const input = await $('[data-testid="immersive-input"]')
            if (await input.isExisting()) {
                state.title = await input.getValue()
            }
        } catch {
            state.title = ''
        }

        try {
            const table = await this.episodeTable
            if (await table.isExisting()) {
                const rows = await table.$$('tr')

                for (const row of rows) {
                    const cells = await row.$$('td')

                    if (cells.length === 0) continue

                    const firstCellText = await cells[0].getText()
                    
                    const idMatch = firstCellText.match(/^S(\d+)E(\d+)$/)
                    if (idMatch) {
                        const tableRow: TvShowPanelState['table'][number] = {
                            id: firstCellText,
                            type: 'episode',
                            checkbox: false,
                            videoFile: '',
                            thumbnail: '',
                            nfo: '',
                            subtitle: ''
                        }

                        let cellIndex = 1

                        if (cells.length > cellIndex) {
                            const nextCell = await cells[cellIndex].$('input[type="checkbox"]')
                            const hasCheckbox = await nextCell.isExisting().catch(() => false)
                            if (hasCheckbox) {
                                tableRow.checkbox = await nextCell.isSelected()
                                cellIndex++
                            }
                        }

                        if (cells.length > cellIndex) {
                            tableRow.videoFile = await cells[cellIndex].getText()
                            cellIndex++
                        }
                        if (cells.length > cellIndex) {
                            tableRow.thumbnail = await this.checkCellHasValue(cells[cellIndex])
                            cellIndex++
                        }
                        if (cells.length > cellIndex) {
                            tableRow.subtitle = await this.checkCellHasValue(cells[cellIndex])
                            cellIndex++
                        }
                        if (cells.length > cellIndex) {
                            tableRow.nfo = await this.checkCellHasValue(cells[cellIndex])
                        }

                        state.table.push(tableRow)
                    } else if (firstCellText.length > 0 && !firstCellText.match(/^\s*$/)) {
                        state.table.push({
                            id: firstCellText.trim(),
                            type: 'divider'
                        })
                    }
                }
            }
        } catch {
            state.table = []
        }

        return state
    }

    async waitForTitleToBe(expected: string, timeout: number = 10000): Promise<void> {
        const input = await $('[data-testid="immersive-input"]')
        await input.waitForDisplayed({ timeout })
        await browser.waitUntil(
            async () => (await input.getValue()) === expected,
            {
                timeout,
                timeoutMsg: `Expected title to be "${expected}", but got "${await input.getValue()}"`
            }
        )
    }

    /**
     * Wait for the panel state to match a predicate
     * @param predicate Function that receives the current state and returns true if condition is met
     * @param timeout Timeout in milliseconds (default: 30000)
     * @param interval Polling interval in milliseconds (default: 500)
     */
    async waitForState(
        predicate: (state: TvShowPanelState) => boolean,
        timeout: number = 30000,
        interval: number = 500
    ): Promise<TvShowPanelState> {
        return await browser.waitUntil(async () => {
            const state = await this.getState()
            return predicate(state)
        }, {
            timeout,
            timeoutMsg: `TVShowPanel state did not match predicate after ${timeout}ms`,
            interval
        })
    }

    /**
     * Check if a table cell contains a CheckIcon (indicating a file exists)
     * vs a MinusIcon (indicating no file)
     */
    private async checkCellHasValue(cell: WebdriverIO.Element): Promise<string> {
        try {
            const checkIcon = await cell.$('svg.text-emerald-600')
            return await checkIcon.isExisting().catch(() => false) ? 'V' : '-'
        } catch {
            return '-'
        }
    }

    /**
     * Print the TvShowPanel component in a human-readable string format.
     * 
     * Example output:
     * 特别篇
     * S00E01 -
     * 第 1 季
     * S01E01 S01E01.mkv - - -
     * S01E02 S01E02.mkv - - -
     * S01E03 S01E03.mkv - - -
     * S01E04 - - - -
     * S01E05 - - - -
     * S01E06 - - - -
     * S01E07 - - - -
     * S01E08 - - - -
     * S01E09 - - - -
     * S01E10 - - - -
     * S01E11 - - - -
     * S01E12 - - - -
     * 
     * Format for episode rows: ID videoFile thumbnail subtitle nfo
     * - "-" means no file
     * - "V" means file exists
     */
    async toString(): Promise<string> {
        const state = await this.getState()
        const lines: string[] = []

        for (const row of state.table) {
            if (row.type === 'divider') {
                lines.push(row.id)
            } else {
                const parts = [row.id, row.videoFile || '-']
                parts.push(row.thumbnail)
                parts.push(row.subtitle)
                parts.push(row.nfo)
                lines.push(parts.join(' '))
            }
        }

        return lines.join('\n')
    }
}

export default new TVShowPanel()
