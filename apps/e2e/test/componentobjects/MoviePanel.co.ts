/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'
import SearchboxCO from './Searchbox.co'

class MoviePanelComponentObject {

    get table() {
        return $('[data-testid="tvshow-episode-table"]')
    }

    get input() {
        return this.searchbox.input
    }

    get results() {
        return this.searchbox.results
    }

    async getResults() {
        return this.searchbox.getResults()
    }

    get searchbox() {
        return SearchboxCO
    }

    /** Matches {@link MovieHeaderV2} subtitle dropdown trigger. */
    get subtitleMenuButton() {
        return $('[data-testid="movie-header-subtitle"]')
    }

    /** Matches {@link MovieHeaderV2} transcribe control. */
    get transcribeButton() {
        return $('[data-testid="movie-header-transcribe"]')
    }

    async openSubtitleMenu(): Promise<void> {
        const button = await this.subtitleMenuButton
        await button.waitForClickable({ timeout: 10_000 })
        await button.click()
        await browser.pause(200)
    }

    async clickHeaderTranscribe(): Promise<void> {
        await this.openSubtitleMenu()
        const item = await this.transcribeButton
        await item.waitForClickable({ timeout: 5000 })
        await item.click()
    }

    async waitForTitleToBe(expected: string, timeout: number = 10000): Promise<void> {
        await this.searchbox.waitForTitleToBe(expected, timeout)
    }

}

const MoviePanelCO = new MoviePanelComponentObject()
export default MoviePanelCO