/// <reference types="@wdio/globals/types" />

import SearchboxCO from './Searchbox.co'

class MoviePanelComponentObject {

    get table() {
        return $('[data-testid="movie-episode-table"]')
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

    async waitForTitleToBe(expected: string, timeout: number = 10000): Promise<void> {
        await this.searchbox.waitForTitleToBe(expected, timeout)
    }

}

const MoviePanelCO = new MoviePanelComponentObject()
export default MoviePanelCO