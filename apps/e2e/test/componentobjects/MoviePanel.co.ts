/// <reference types="@wdio/globals/types" />

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

    /** Matches {@link MovieHeaderV2} transcribe control. */
    get transcribeButton() {
        return $('[data-testid="movie-header-transcribe"]')
    }

    async waitForTitleToBe(expected: string, timeout: number = 10000): Promise<void> {
        await this.searchbox.waitForTitleToBe(expected, timeout)
    }

}

const MoviePanelCO = new MoviePanelComponentObject()
export default MoviePanelCO