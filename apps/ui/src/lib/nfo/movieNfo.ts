import type { NfoThumb, ThumbAspect, TvShowNFOActor, TvShowNFORating, TvShowNFOUniqueId } from "./tvshowNfo"

/** @see TvShowNFORating — same `<ratings><rating>…` shape as tvshow NFO */
type MovieNFORating = TvShowNFORating

type MovieNFOUniqueId = TvShowNFOUniqueId

type MovieNFOActor = TvShowNFOActor

interface MovieNFOSet {
  name?: string
  overview?: string
}

/** `<credits>` / `<director>`: optional `tmdbid` attribute + text name */
interface MovieNFOTextCredit {
  tmdbid?: string
  name?: string
}

interface MovieNFOProducer {
  tmdbid?: string
  name?: string
  role?: string
  profile?: string
}

interface MovieNFOVideoStream {
  codec?: string
  aspect?: number
  width?: number
  height?: number
  durationInSeconds?: number
}

interface MovieNFOStreamDetails {
  videos?: MovieNFOVideoStream[]
}

interface MovieNFOFileInfo {
  streamDetails?: MovieNFOStreamDetails
}

export interface MovieNFO {
  title?: string
  originalTitle?: string
  sortTitle?: string
  epbookmark?: string
  year?: number
  ratings?: MovieNFORating[]
  userRating?: number
  top250?: number
  set?: MovieNFOSet
  plot?: string
  outline?: string
  tagline?: string
  runtime?: number
  thumbs?: NfoThumb[]
  fanartThumbs?: string[]
  mpaa?: string
  certification?: string
  /** Often IMDb id as plain text, e.g. `tt37334010` */
  id?: string
  imdbid?: string
  tmdbid?: string
  tvdbid?: string
  uniqueIds?: MovieNFOUniqueId[]
  countries?: string[]
  status?: string
  code?: string
  premiered?: string
  watched?: boolean
  playcount?: number
  genres?: string[]
  studios?: string[]
  credits?: MovieNFOTextCredit[]
  directors?: MovieNFOTextCredit[]
  actors?: MovieNFOActor[]
  producers?: MovieNFOProducer[]
  trailer?: string
  languages?: string
  dateadded?: string
  fileInfo?: MovieNFOFileInfo
  source?: string
  edition?: string
  originalFilename?: string
  userNote?: string
}

function parseIntField(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? undefined : n
}

function parseFloatField(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined
  const n = parseFloat(value)
  return Number.isNaN(n) ? undefined : n
}

function parseBooleanField(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === "true") return true
  if (normalized === "false") return false
  return undefined
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
  const collectTextList = (selector: string) =>
    Array.from(movie.querySelectorAll(selector))
      .map((el) => el.textContent?.trim() || undefined)
      .filter((v): v is string => v !== undefined && v !== "")

  movieNfo.title = getTextContent("title")
  movieNfo.originalTitle = getTextContent("originaltitle")
  movieNfo.sortTitle = getTextContent("sorttitle")
  movieNfo.epbookmark = getTextContent("epbookmark")
  movieNfo.year = parseIntField(getTextContent("year"))
  movieNfo.userRating = parseIntField(getTextContent("userrating"))
  movieNfo.top250 = parseIntField(getTextContent("top250"))
  movieNfo.plot = getTextContent("plot")
  movieNfo.outline = getTextContent("outline")
  movieNfo.tagline = getTextContent("tagline")
  movieNfo.runtime = parseIntField(getTextContent("runtime"))
  movieNfo.mpaa = getTextContent("mpaa")
  movieNfo.certification = getTextContent("certification")
  movieNfo.id = getTextContent("id")
  movieNfo.imdbid = getTextContent("imdbid")
  movieNfo.tmdbid = getTextContent("tmdbid")
  movieNfo.tvdbid = getTextContent("tvdbid")
  movieNfo.status = getTextContent("status")
  movieNfo.code = getTextContent("code")
  movieNfo.premiered = getTextContent("premiered")
  movieNfo.watched = parseBooleanField(getTextContent("watched"))
  movieNfo.playcount = parseIntField(getTextContent("playcount"))
  movieNfo.trailer = getTextContent("trailer")
  movieNfo.languages = getTextContent("languages")
  movieNfo.dateadded = getTextContent("dateadded")
  movieNfo.source = getTextContent("source")
  movieNfo.edition = getTextContent("edition")
  movieNfo.originalFilename = getTextContent("original_filename")
  movieNfo.userNote = getTextContent("user_note")

  const setEl = movie.querySelector(":scope > set")
  if (setEl) {
    const name = setEl.querySelector(":scope > name")?.textContent?.trim() || undefined
    const overview = setEl.querySelector(":scope > overview")?.textContent?.trim() || undefined
    if (name !== undefined || overview !== undefined) {
      movieNfo.set = { name, overview }
    }
  }

  const thumbElements = Array.from(movie.children).filter((el): el is Element => el.tagName.toLowerCase() === "thumb")
  if (thumbElements.length > 0) {
    movieNfo.thumbs = thumbElements
      .map((thumbEl) => {
        const url = thumbEl.textContent?.trim()
        if (!url) return null
        const thumb: NfoThumb = { url, aspect: (thumbEl.getAttribute("aspect") as ThumbAspect) || null }
        const seasonAttr = thumbEl.getAttribute("season")
        if (seasonAttr !== null) {
          const season = parseInt(seasonAttr, 10)
          if (!Number.isNaN(season)) thumb.season = season
        }
        const typeAttr = thumbEl.getAttribute("type")
        if (typeAttr) thumb.type = typeAttr
        return thumb
      })
      .filter((thumb): thumb is NfoThumb => thumb !== null)
  }

  const fanartThumbs = collectTextList("fanart > thumb")
  if (fanartThumbs.length > 0) movieNfo.fanartThumbs = fanartThumbs

  const ratingElements = movie.querySelectorAll(":scope > ratings > rating")
  if (ratingElements.length > 0) {
    movieNfo.ratings = Array.from(ratingElements).map((ratingEl) => ({
      default: parseBooleanField(ratingEl.getAttribute("default") || undefined),
      max: parseIntField(ratingEl.getAttribute("max") || undefined),
      name: ratingEl.getAttribute("name") || undefined,
      value: parseFloatField(ratingEl.querySelector("value")?.textContent?.trim() || undefined),
      votes: parseIntField(ratingEl.querySelector("votes")?.textContent?.trim() || undefined),
    }))
  }

  const uniqueIdElements = movie.querySelectorAll(":scope > uniqueid")
  if (uniqueIdElements.length > 0) {
    movieNfo.uniqueIds = Array.from(uniqueIdElements).map((el) => ({
      default: parseBooleanField(el.getAttribute("default") || undefined),
      type: el.getAttribute("type") || undefined,
      value: el.textContent?.trim() || undefined,
    }))
  }

  const countries = collectTextList(":scope > country")
  if (countries.length > 0) movieNfo.countries = countries
  const genres = collectTextList(":scope > genre")
  if (genres.length > 0) movieNfo.genres = genres
  const studios = collectTextList(":scope > studio")
  if (studios.length > 0) movieNfo.studios = studios

  const creditsEls = movie.querySelectorAll(":scope > credits")
  if (creditsEls.length > 0) {
    movieNfo.credits = Array.from(creditsEls).map((el) => ({
      tmdbid: el.getAttribute("tmdbid") || undefined,
      name: el.textContent?.trim() || undefined,
    }))
  }

  const directorEls = movie.querySelectorAll(":scope > director")
  if (directorEls.length > 0) {
    movieNfo.directors = Array.from(directorEls).map((el) => ({
      tmdbid: el.getAttribute("tmdbid") || undefined,
      name: el.textContent?.trim() || undefined,
    }))
  }

  const actorEls = movie.querySelectorAll(":scope > actor")
  if (actorEls.length > 0) {
    movieNfo.actors = Array.from(actorEls).map((actorEl) => ({
      name: actorEl.querySelector("name")?.textContent?.trim() || undefined,
      role: actorEl.querySelector("role")?.textContent?.trim() || undefined,
      thumb: actorEl.querySelector("thumb")?.textContent?.trim() || undefined,
      profile: actorEl.querySelector("profile")?.textContent?.trim() || undefined,
      tmdbid: actorEl.querySelector("tmdbid")?.textContent?.trim() || undefined,
    }))
  }

  const producerEls = movie.querySelectorAll(":scope > producer")
  if (producerEls.length > 0) {
    movieNfo.producers = Array.from(producerEls).map((el) => ({
      tmdbid: el.getAttribute("tmdbid") || undefined,
      name: el.querySelector("name")?.textContent?.trim() || undefined,
      role: el.querySelector("role")?.textContent?.trim() || undefined,
      profile: el.querySelector("profile")?.textContent?.trim() || undefined,
    }))
  }

  const streamDetailsEl = movie.querySelector(":scope > fileinfo > streamdetails")
  if (streamDetailsEl) {
    const videoEls = streamDetailsEl.querySelectorAll(":scope > video")
    if (videoEls.length > 0) {
      const videos = Array.from(videoEls).map((videoEl) => ({
        codec: videoEl.querySelector("codec")?.textContent?.trim() || undefined,
        aspect: parseFloatField(videoEl.querySelector("aspect")?.textContent?.trim() || undefined),
        width: parseIntField(videoEl.querySelector("width")?.textContent?.trim() || undefined),
        height: parseIntField(videoEl.querySelector("height")?.textContent?.trim() || undefined),
        durationInSeconds: parseIntField(
          videoEl.querySelector("durationinseconds")?.textContent?.trim() || undefined,
        ),
      }))
      movieNfo.fileInfo = { streamDetails: { videos } }
    }
  }

  return movieNfo
}
