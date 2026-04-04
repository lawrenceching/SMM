class MoviePanelComponentObject {

    get table() {
        return $('[data-testid="movie-episode-table"]')
    }

    get input() {
        return $('[data-testid="immersive-input"]')
    }

}

const MoviePanelCO = new MoviePanelComponentObject()
export default MoviePanelCO