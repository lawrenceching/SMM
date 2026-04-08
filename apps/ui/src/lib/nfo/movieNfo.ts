import type { NfoThumb, ThumbAspect, TvShowNFOActor, TvShowNFORating, TvShowNFOUniqueId } from "./tvshowNfo"

/** @see TvShowNFORating — same `<ratings><rating>…` shape as tvshow NFO */
export type MovieNFORating = TvShowNFORating

export type MovieNFOUniqueId = TvShowNFOUniqueId

export type MovieNFOActor = TvShowNFOActor

export interface MovieNFOSet {
  name?: string
  overview?: string
}

/** `<credits>` / `<director>`: optional `tmdbid` attribute + text name */
export interface MovieNFOTextCredit {
  tmdbid?: string
  name?: string
}

export interface MovieNFOProducer {
  tmdbid?: string
  name?: string
  role?: string
  profile?: string
}

export interface MovieNFOVideoStream {
  codec?: string
  aspect?: number
  width?: number
  height?: number
  durationInSeconds?: number
}

export interface MovieNFOStreamDetails {
  videos?: MovieNFOVideoStream[]
}

export interface MovieNFOFileInfo {
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

function formatXml(xml: string): string {
  const PADDING = "  "
  const reg = /(>)(<)(\/*)/g
  let formatted = ""
  xml = xml.replace(reg, "$1\n$2$3")
  let pad = 0
  xml.split("\n").forEach((node) => {
    let indent = 0
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0
    } else if (node.match(/^<\/\w/)) {
      if (pad > 0) pad -= 1
    } else if (node.match(/^<\w([^>]*[^/])?>.*$/)) {
      indent = 1
    }
    formatted += PADDING.repeat(pad) + node + "\n"
    pad += indent
  })
  return formatted.trim()
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

export function convertMovieNfoToXml(nfo: MovieNFO): string {
  const doc = document.implementation.createDocument(null, "movie", null)
  const root = doc.documentElement
  const addElement = (name: string, value: string) => {
    const el = doc.createElement(name)
    el.textContent = value
    root.appendChild(el)
  }
  const addOptionalText = (name: string, value: string | undefined) => {
    if (value !== undefined) addElement(name, value)
  }
  const addOptionalNumber = (name: string, value: number | undefined) => {
    if (value !== undefined) addElement(name, String(value))
  }

  addOptionalText("title", nfo.title)
  addOptionalText("originaltitle", nfo.originalTitle)
  addOptionalText("sorttitle", nfo.sortTitle)
  addOptionalText("epbookmark", nfo.epbookmark)
  addOptionalNumber("year", nfo.year)
  if (nfo.ratings?.length) {
    const ratingsEl = doc.createElement("ratings")
    for (const r of nfo.ratings) {
      const ratingEl = doc.createElement("rating")
      if (r.default !== undefined) ratingEl.setAttribute("default", String(r.default))
      if (r.max !== undefined) ratingEl.setAttribute("max", String(r.max))
      if (r.name) ratingEl.setAttribute("name", r.name)
      if (r.value !== undefined) {
        const valueEl = doc.createElement("value")
        valueEl.textContent = String(r.value)
        ratingEl.appendChild(valueEl)
      }
      if (r.votes !== undefined) {
        const votesEl = doc.createElement("votes")
        votesEl.textContent = String(r.votes)
        ratingEl.appendChild(votesEl)
      }
      ratingsEl.appendChild(ratingEl)
    }
    root.appendChild(ratingsEl)
  }
  addOptionalNumber("userrating", nfo.userRating)
  addOptionalNumber("top250", nfo.top250)
  if (nfo.set && (nfo.set.name !== undefined || nfo.set.overview !== undefined)) {
    const setEl = doc.createElement("set")
    if (nfo.set.name !== undefined) {
      const nameEl = doc.createElement("name")
      nameEl.textContent = nfo.set.name
      setEl.appendChild(nameEl)
    }
    if (nfo.set.overview !== undefined) {
      const overviewEl = doc.createElement("overview")
      overviewEl.textContent = nfo.set.overview
      setEl.appendChild(overviewEl)
    }
    root.appendChild(setEl)
  }
  addOptionalText("plot", nfo.plot)
  addOptionalText("outline", nfo.outline)
  addOptionalText("tagline", nfo.tagline)
  addOptionalNumber("runtime", nfo.runtime)

  nfo.thumbs?.forEach((thumb) => {
    if (!thumb.url) return
    const thumbEl = doc.createElement("thumb")
    thumbEl.textContent = thumb.url
    if (thumb.aspect) thumbEl.setAttribute("aspect", thumb.aspect)
    if (thumb.season !== undefined) thumbEl.setAttribute("season", String(thumb.season))
    if (thumb.type) thumbEl.setAttribute("type", thumb.type)
    root.appendChild(thumbEl)
  })
  if (nfo.fanartThumbs?.length) {
    const fanartEl = doc.createElement("fanart")
    nfo.fanartThumbs.forEach((thumbUrl) => {
      if (!thumbUrl) return
      const thumbEl = doc.createElement("thumb")
      thumbEl.textContent = thumbUrl
      fanartEl.appendChild(thumbEl)
    })
    root.appendChild(fanartEl)
  }

  addOptionalText("mpaa", nfo.mpaa)
  addOptionalText("certification", nfo.certification)
  addOptionalText("id", nfo.id)
  addOptionalText("imdbid", nfo.imdbid)
  addOptionalText("tmdbid", nfo.tmdbid)
  addOptionalText("tvdbid", nfo.tvdbid)
  nfo.uniqueIds?.forEach((uniqueId) => {
    const uniqueIdEl = doc.createElement("uniqueid")
    if (uniqueId.default !== undefined) uniqueIdEl.setAttribute("default", String(uniqueId.default))
    if (uniqueId.type) uniqueIdEl.setAttribute("type", uniqueId.type)
    if (uniqueId.value !== undefined) uniqueIdEl.textContent = uniqueId.value
    root.appendChild(uniqueIdEl)
  })

  nfo.countries?.forEach((country) => country && addElement("country", country))
  addOptionalText("status", nfo.status)
  addOptionalText("code", nfo.code)
  addOptionalText("premiered", nfo.premiered)
  if (nfo.watched !== undefined) addElement("watched", String(nfo.watched))
  addOptionalNumber("playcount", nfo.playcount)
  nfo.genres?.forEach((genre) => genre && addElement("genre", genre))
  nfo.studios?.forEach((studio) => studio && addElement("studio", studio))

  nfo.credits?.forEach((credit) => {
    if (credit.name === undefined) return
    const el = doc.createElement("credits")
    if (credit.tmdbid) el.setAttribute("tmdbid", credit.tmdbid)
    el.textContent = credit.name
    root.appendChild(el)
  })
  nfo.directors?.forEach((director) => {
    if (director.name === undefined) return
    const el = doc.createElement("director")
    if (director.tmdbid) el.setAttribute("tmdbid", director.tmdbid)
    el.textContent = director.name
    root.appendChild(el)
  })

  nfo.actors?.forEach((actor) => {
    const actorEl = doc.createElement("actor")
    if (actor.name !== undefined) {
      const el = doc.createElement("name")
      el.textContent = actor.name
      actorEl.appendChild(el)
    }
    if (actor.role !== undefined) {
      const el = doc.createElement("role")
      el.textContent = actor.role
      actorEl.appendChild(el)
    }
    if (actor.thumb !== undefined) {
      const el = doc.createElement("thumb")
      el.textContent = actor.thumb
      actorEl.appendChild(el)
    }
    if (actor.profile !== undefined) {
      const el = doc.createElement("profile")
      el.textContent = actor.profile
      actorEl.appendChild(el)
    }
    if (actor.tmdbid !== undefined) {
      const el = doc.createElement("tmdbid")
      el.textContent = actor.tmdbid
      actorEl.appendChild(el)
    }
    root.appendChild(actorEl)
  })
  nfo.producers?.forEach((producer) => {
    const producerEl = doc.createElement("producer")
    if (producer.tmdbid) producerEl.setAttribute("tmdbid", producer.tmdbid)
    if (producer.name !== undefined) {
      const el = doc.createElement("name")
      el.textContent = producer.name
      producerEl.appendChild(el)
    }
    if (producer.role !== undefined) {
      const el = doc.createElement("role")
      el.textContent = producer.role
      producerEl.appendChild(el)
    }
    if (producer.profile !== undefined) {
      const el = doc.createElement("profile")
      el.textContent = producer.profile
      producerEl.appendChild(el)
    }
    root.appendChild(producerEl)
  })

  addOptionalText("trailer", nfo.trailer)
  addOptionalText("languages", nfo.languages)
  addOptionalText("dateadded", nfo.dateadded)
  addOptionalText("source", nfo.source)
  addOptionalText("edition", nfo.edition)
  addOptionalText("original_filename", nfo.originalFilename)
  addOptionalText("user_note", nfo.userNote)

  if (nfo.fileInfo?.streamDetails?.videos?.length) {
    const fileInfoEl = doc.createElement("fileinfo")
    const streamDetailsEl = doc.createElement("streamdetails")
    nfo.fileInfo.streamDetails.videos.forEach((video) => {
      const videoEl = doc.createElement("video")
      if (video.codec !== undefined) {
        const codecEl = doc.createElement("codec")
        codecEl.textContent = video.codec
        videoEl.appendChild(codecEl)
      }
      if (video.aspect !== undefined) {
        const aspectEl = doc.createElement("aspect")
        aspectEl.textContent = String(video.aspect)
        videoEl.appendChild(aspectEl)
      }
      if (video.width !== undefined) {
        const widthEl = doc.createElement("width")
        widthEl.textContent = String(video.width)
        videoEl.appendChild(widthEl)
      }
      if (video.height !== undefined) {
        const heightEl = doc.createElement("height")
        heightEl.textContent = String(video.height)
        videoEl.appendChild(heightEl)
      }
      if (video.durationInSeconds !== undefined) {
        const dEl = doc.createElement("durationinseconds")
        dEl.textContent = String(video.durationInSeconds)
        videoEl.appendChild(dEl)
      }
      streamDetailsEl.appendChild(videoEl)
    })
    fileInfoEl.appendChild(streamDetailsEl)
    root.appendChild(fileInfoEl)
  }

  const serializer = new XMLSerializer()
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + formatXml(serializer.serializeToString(doc))
}
