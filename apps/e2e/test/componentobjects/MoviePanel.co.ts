/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

class MoviePanelComponentObject {

    get table() {
        return $('[data-testid="movie-episode-table"]')
    }

    get input() {
        return $('[data-testid="immersive-input"]')
    }

    async waitForTitleToBe(expected: string, timeout: number = 10000): Promise<void> {
        await this.input.waitForDisplayed({ timeout });
        await browser.waitUntil(
            async () => (await this.input.getValue()) === expected,
            {
                timeout,
                timeoutMsg: `Expected title to be "${expected}", but got "${await this.input.getValue()}"`
            }
        )
    }

}

const MoviePanelCO = new MoviePanelComponentObject()
export default MoviePanelCO