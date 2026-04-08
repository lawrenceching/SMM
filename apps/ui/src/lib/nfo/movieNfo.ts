export interface MovieNFO {
  title?: string
  originalTitle?: string
  year?: number
  tmdbid?: string
  plot?: string
  outline?: string
  runtime?: number
}

export async function parseMovieNfo(xml: string): Promise<MovieNFO | undefined> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "text/xml")
  const parseError = doc.querySelector("parsererror")
  if (parseError) {
    throw new Error(`Failed to parse XML: ${parseError.textContent}`)
  }
  const movie = doc.querySelector("movie")
  if (!movie) return undefined

  const movieNfo: MovieNFO = {}
  const getTextContent = (selector: string): string | undefined => {
    const element = movie.querySelector(selector)
    return element?.textContent?.trim() || undefined
  }
  movieNfo.title = getTextContent("title")
  movieNfo.originalTitle = getTextContent("originaltitle")
  movieNfo.plot = getTextContent("plot")
  movieNfo.outline = getTextContent("outline")
  const yearText = getTextContent("year")
  if (yearText !== undefined) {
    const year = parseInt(yearText, 10)
    if (!isNaN(year)) movieNfo.year = year
  }
  movieNfo.tmdbid = getTextContent("tmdbid")
  const runtimeText = getTextContent("runtime")
  if (runtimeText !== undefined) {
    const runtime = parseInt(runtimeText, 10)
    if (!isNaN(runtime)) movieNfo.runtime = runtime
  }
  return movieNfo
}
