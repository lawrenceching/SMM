/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'
import { waitForDisplay } from '../lib/waitForDisplay'

class SearchboxComponentObject {
    private async getFirstInput() {
        const input = await $('[data-testid="immersive-input"]')
        return input
    }

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

    get results() {
        return $$('[data-testid="tmdb-search-result-item"]')
    }

    async getResults() {
        return this.results
    }

    async waitForTitleToBe(expected: string, timeout: number = 10000): Promise<void> {
        await waitForDisplay('[data-testid="immersive-input"]', {
            timeout,
            interval: 200,
            timeoutMsg: `immersive-input was not displayed after ${timeout}ms`,
        })

        await browser.waitUntil(
            async () => {
                const input = await this.getFirstInput()
                const displayed = await input.isDisplayed().catch(() => false)
                if (!displayed) {
                    return false
                }
                const value = await input.getValue().catch(() => '')
                return value === expected
            },
            {
                interval: 200,
                timeout,
                timeoutMsg: `Expected title to be "${expected}", but current immersive-input value is different`
            }
        )
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

    async setLanguage(languageOrCode: string) {
        const selectTrigger = await this.language

        await selectTrigger.waitForExist({ timeout: 5000 })
        await selectTrigger.waitForDisplayed({ timeout: 5000 })
        await selectTrigger.waitForClickable({ timeout: 5000 })
        await selectTrigger.click()

        await browser.pause(300)

        const byCode = await $(`[data-testid="tmdb-search-language-option-${languageOrCode}"]`)
        if (await byCode.isExisting()) {
            await byCode.waitForClickable({ timeout: 5000 })
            await byCode.click()
            return
        }

        const selectItems = await $$('[data-testid^="tmdb-search-language-option-"]')
        let targetItem: WebdriverIO.Element | undefined

        for (const item of selectItems) {
            const text = (await item.getText()).trim()
            if (
                text === languageOrCode ||
                text.startsWith(`${languageOrCode} (`) ||
                text.endsWith(`(${languageOrCode})`)
            ) {
                targetItem = item
                break
            }
        }

        if (!targetItem) {
            throw new Error(`Language option "${languageOrCode}" not found`)
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

    async selectSearchResult(options: { title?: string, date?: string }) {
        const { title, date } = options
        if (title === undefined && date === undefined) {
            throw new Error('Either title or date must be provided')
        }

        const expectedDate = date

        await browser.waitUntil(
            async () => {
                const resultItems = await this.results
                return (await resultItems.length) > 0
            },
            {
                timeout: 10000,
                interval: 200,
                timeoutMsg: 'Search result items did not appear after 10000ms',
            }
        )

        const rows = await this.results
        const matchedRows: WebdriverIO.Element[] = []
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

        const clickableRow = await matchedRow.$('..')
        await clickableRow.waitForClickable({ timeout: 5000 })
        await clickableRow.click()
    }
}

export const SearchboxCO = new SearchboxComponentObject()
export default SearchboxCO
