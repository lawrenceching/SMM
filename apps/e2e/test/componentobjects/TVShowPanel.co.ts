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

class MediaDatabaseSearchboxCO {

    get input() {
        return $('[data-testid="immersive-input"]')
    }

    get database() {
        return $('#tmdb-search-database')
    }

    get language() {
        return $('#tmdb-search-language')
    }

    get searchButton() {
        return $('[data-testid="immersive-input-search-button"]')
    }

    async setDatabase(database: string) {
        const selectTrigger = await this.database
        
        await selectTrigger.waitForExist({ timeout: 5000 })
        await selectTrigger.waitForDisplayed({ timeout: 5000 })
        await selectTrigger.waitForClickable({ timeout: 5000 })
        await selectTrigger.click()

        await browser.pause(300)
        const selectItem = await $(`[data-testid="tmdb-search-database-option-${database}"]`)
        await selectItem.waitForExist({ timeout: 5000 })
        await selectItem.waitForDisplayed({ timeout: 5000 })
        await selectItem.waitForClickable({ timeout: 5000 })
        await selectItem.click()

    }

    async setLanguage(language: string) {
        const selectTrigger = await this.language
        
        await selectTrigger.waitForExist({ timeout: 5000 })
        await selectTrigger.waitForDisplayed({ timeout: 5000 })
        await selectTrigger.waitForClickable({ timeout: 5000 })
        await selectTrigger.click()

        await browser.pause(300)
        
        const selectItems = await $$(`[data-testid^="tmdb-search-language-option-"]`)
        let targetItem
        
        for (const item of selectItems) {
            const text = await item.getText()
            if (text === language) {
                targetItem = item
                break
            }
        }
        
        if (!targetItem) {
            throw new Error(`Language option "${language}" not found`)
        }
        
        await targetItem.waitForClickable({ timeout: 5000 })
        await targetItem.click()

    }

    async selectSearchResultByText(text: string) {
        const resultItem = await $(`//h3[contains(text(),"${text}")]`)
        await resultItem.waitForDisplayed({ timeout: 1000 })
        const clickableRow = await resultItem.$('..').$('..').$('..')
        await clickableRow.click()
    }

    async selectSearchResult(options: {title?: string, date?: string}) {

        const { title, date } = options
        if(title === undefined && date === undefined) {
            throw new Error('Either title or date must be provided')
        }

        const expectedDate = date

        await browser.waitUntil(
            async () => {
                const resultItems = await $$('[data-testid="tmdb-search-result-item"]')
                return (await resultItems.length) > 0
            },
            {
                timeout: 10000,
                interval: 200,
                timeoutMsg: 'Search result items did not appear after 10000ms',
            }
        )

        const rows = await $$('[data-testid="tmdb-search-result-item"]')
        const matchedRows = []
        for (const row of rows) {
            let matches = true

            if (title !== undefined) {
                const titleEl = await row.$('h3')
                const titleText = (await titleEl.getText()).trim()
                matches = matches && titleText === title
            }

            if (date !== undefined) {
                const dateEl = await row.$('[data-testid="search-result-item-date"]')
                const hasDate = await dateEl.isExisting().catch(() => false)
                if (!hasDate) {
                    matches = false
                } else {
                    const dateText = (await dateEl.getText()).trim()
                    matches = matches && dateText === expectedDate
                }
            }

            if (matches) {
                matchedRows.push(row)
            }
        }

        if (matchedRows.length === 0) {
            throw new Error(
                `No search result matched title="${title ?? '*'}" date="${expectedDate ?? '*'}"`
            )
        }

        if (matchedRows.length > 1) {
            throw new Error(
                `Multiple search results matched title="${title ?? '*'}" date="${expectedDate ?? '*'}". Please provide both title and date to disambiguate.`
            )
        }

        const matchedRow = matchedRows[0]
        if (!matchedRow) {
            throw new Error('Internal error: matched row is undefined')
        }

        // Click the actual clickable row wrapper.
        const clickableRow = await matchedRow.$('..')
        await clickableRow.waitForClickable({ timeout: 5000 })
        await clickableRow.click()
    }

}

class TVShowPanel {
    /**
     * Get the immersive search input (movie/tv title input)
     */
    get immersiveInput() {
        return $('[data-testid="immersive-input"]')
    }

    /**
     * Get the episode table element
     */
    get episodeTable() {
        return $('[data-testid="tvshow-episode-table"]')
    }

    /**
     * Get the floating prompt container
     * @deprecated Use Prompts.aiBasedRenamePrompt instead
     *
     */
    get floatingPrompt() {
        return $('[data-testid="ai-rename-floating-prompt"]')
    }

    /**
     * Get the confirm button (supports en and zh-CN labels)
     */
    get confirmButton() {
        return $('[data-testid="floating-prompt-confirm-button"]')
    }

    get recognizeButton() {
        return $('[data-testid="recognize-button"]')
    }

    get renameButton() {
        return $('[data-testid="rename-button"]')
    }

    // private async getConfirmButton() {
    //     for (const label of CONFIRM_LABELS) {
    //         const btn = await $('button=' + label)
    //         if (await btn.isExisting().catch(() => false)) {
    //             return btn
    //         }
    //     }
    //     return await $('button=Confirm')
    // }

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
     * Open the context menu for a specific episode row by its ID (e.g., 'S01E01').
     * This simulates a right-click on the corresponding table row.
     */
    async openContextMenuForEpisode(episodeId: string): Promise<void> {
        const episodeIdCell = await $('td=' + episodeId)
        await episodeIdCell.waitForDisplayed({ timeout: 10000 })
        const row = await episodeIdCell.parentElement()
        await row.click({ button: 'right' })
    }

    /**
     * Open context menu for given episode and click a specific item by English label.
     * Internally maps the English label to localized variants (currently zh-CN).
     */
    async openAndClickContextMenuForEpisode(episodeId: string, labelEn: string): Promise<void> {
        const labelMap: Record<string, string[]> = {
            'Select File': ['Select File', '选择文件'],
        }

        const labels = labelMap[labelEn] ?? [labelEn]

        await this.openContextMenuForEpisode(episodeId)
        await browser.pause(300)
        console.log(`[TVShowPanel] Right-clicked on episode row ${episodeId}`)

        await browser.waitUntil(
            async () => {
                for (const label of labels) {
                    const item = await $(`[role="menuitem"]=${label}`)
                    if (await item.isDisplayed().catch(() => false)) return true
                }
                return false
            },
            {
                timeout: 5000,
                interval: 200,
                timeoutMsg: `Context menu item [${labels.join(', ')}] did not appear`,
            }
        )

        for (const label of labels) {
            const item = await $(`[role="menuitem"]=${label}`)
            if (await item.isDisplayed().catch(() => false)) {
                await item.waitForClickable({ timeout: 3000 })
                await item.click()
                console.log(`[TVShowPanel] Clicked context menu item: ${label}`)
                return
            }
        }

        throw new Error(`[TVShowPanel] Context menu item [${labels.join(', ')}] not found`)
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
            const input = await this.immersiveInput
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
                const rowCount = await rows.length

                for (const row of rows) {
                    const cells = await row.$$('td')
                    const cellsCount = await cells.length

                    if (cellsCount === 0) continue

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

                        if (cellsCount > cellIndex) {
                            const nextCell = await cells[cellIndex].$('input[type="checkbox"]')
                            const hasCheckbox = await nextCell.isExisting().catch(() => false)
                            if (hasCheckbox) {
                                tableRow.checkbox = await nextCell.isSelected()
                                cellIndex++
                            }
                        }

                        if (cellsCount > cellIndex) {
                            tableRow.videoFile = await cells[cellIndex].getText()
                            cellIndex++
                        }
                        if (cellsCount > cellIndex) {
                            tableRow.thumbnail = await this.checkCellHasValue(cells[cellIndex])
                            cellIndex++
                        }
                        if (cellsCount > cellIndex) {
                            tableRow.subtitle = await this.checkCellHasValue(cells[cellIndex])
                            cellIndex++
                        }
                        if (cellsCount > cellIndex) {
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
        const input = await this.immersiveInput
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
     * Type a query in the immersive input, run search, and select the result by title.
     * Waits for the result row with the given title to appear and clicks it.
     * @param title The movie/tv title to search for and select
     * @param options.waitForResultTimeout Timeout for result to appear (default 15000)
     * @param options.waitForInputUpdateTimeout Timeout for input value to update after selection (default 10000)
     */
    async searchAndSelectByTitle(
        title: string,
        options: { waitForResultTimeout?: number; waitForInputUpdateTimeout?: number } = {}
    ): Promise<void> {
        const { waitForResultTimeout = 15000, waitForInputUpdateTimeout = 10000 } = options
        const immersiveInput = await this.immersiveInput
        await immersiveInput.waitForDisplayed({ timeout: waitForResultTimeout })
        await immersiveInput.click()
        await immersiveInput.setValue(title)
        await browser.pause(300)

        const searchButton = await $('[data-testid="immersive-input-search-button"]')
        await searchButton.waitForClickable({ timeout: 5000 })
        await searchButton.click()

        const resultItem = await $(`//h3[contains(text(),"${title}")]`)
        await resultItem.waitForDisplayed({ timeout: waitForResultTimeout })
        const clickableRow = await resultItem.$('..').$('..').$('..')
        await clickableRow.click()

        await browser.waitUntil(
            async () => (await immersiveInput.getValue()) === title,
            {
                timeout: waitForInputUpdateTimeout,
                timeoutMsg: `Expected immersive-input value to be "${title}", but got "${await immersiveInput.getValue()}"`
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
     * Wait for the panel string representation using a predicate.
     * The predicate receives the result of toString().
     */
    async waitFor(
        predicate: (state: string) => boolean,
        timeout: number = 5000,
        interval: number = 500
    ): Promise<string> {
        let lastState = ''
        try {
            await browser.waitUntil(
                async () => {
                    lastState = await this.toString()
                    return predicate(lastState)
                },
                {
                    timeout,
                    interval,
                },
            )
        } catch (err: any) {
            const baseMessage = `TVShowPanel string state did not match predicate after ${timeout}ms.\nLast state:\n${lastState}`
            if (err && err.message) {
                throw new Error(`${baseMessage}\nOriginal error: ${err.message}`)
            }
            throw new Error(baseMessage)
        }
        return lastState
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

    get searchbox() {
        return new MediaDatabaseSearchboxCO()
    }

    get scrapeButton() {
        return $('[data-testid="scrape-button"]')
    }
    
}

/**
 * Keep both default export and named export for backwards compatibility.
 */
export const TvShowPanelCO = new TVShowPanel()
export default TvShowPanelCO
