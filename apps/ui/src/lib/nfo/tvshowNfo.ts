export type ThumbAspect = "poster" | "clearlogo" | null

export interface NfoThumb {
  url: string
  aspect: ThumbAspect
  season?: number
  type?: string
}

export interface TvShowNFORating {
  default?: boolean
  max?: number
  name?: string
  value?: number
  votes?: number
}

export interface TvShowNFOUniqueId {
  default?: boolean
  type?: string
  value?: string
}

export interface TvShowNFOActor {
  name?: string
  role?: string
  thumb?: string
  profile?: string
  type?: string
  tmdbid?: string
}

export interface TvShowNFONamedSeason {
  number?: number
  name?: string
}

export interface TvShowNFO {
  title?: string
  originalTitle?: string
  showTitle?: string
  sortTitle?: string
  year?: number
  top250?: number
  ratings?: TvShowNFORating[]
  userRating?: number
  outline?: string
  plot?: string
  tagline?: string
  runtime?: number
  thumbs?: NfoThumb[]
  namedSeasons?: TvShowNFONamedSeason[]
  fanartThumbs?: string[]
  mpaa?: string
  certification?: string
  episodeguide?: string
  id?: string
  imdbid?: string
  tmdbid?: string
  tvdbid?: string
  uniqueIds?: TvShowNFOUniqueId[]
  premiered?: string
  status?: string
  watched?: boolean
  playcount?: number
  genres?: string[]
  studios?: string[]
  countries?: string[]
  tags?: string[]
  actors?: TvShowNFOActor[]
  trailer?: string
  dateadded?: string
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

export class NFO {
  id?: string
  title?: string
  originalTitle?: string
  showTitle?: string
  plot?: string
  thumbs?: NfoThumb[]
  fanart?: string
  tmdbid?: string
  tvdbid?: string

  toXML() {
    const doc = document.implementation.createDocument(null, "tvshow", null)
    const tvshow = doc.documentElement
    const addElement = (name: string, value: string) => {
      const element = doc.createElement(name)
      element.textContent = value
      tvshow.appendChild(element)
    }
    if (this.id) addElement("id", this.id)
    if (this.title) addElement("title", this.title)
    if (this.originalTitle) addElement("originaltitle", this.originalTitle)
    if (this.showTitle) addElement("showtitle", this.showTitle)
    if (this.plot) addElement("plot", this.plot)
    if (this.fanart) addElement("fanart", this.fanart)
    if (this.tmdbid) addElement("tmdbid", this.tmdbid)
    if (this.tvdbid) addElement("tvdbid", this.tvdbid)
    if (this.thumbs?.length) {
      this.thumbs.forEach((thumb) => {
        if (!thumb.url) return
        const thumbEle = doc.createElement("thumb")
        thumbEle.textContent = thumb.url
        if (thumb.aspect) thumbEle.setAttribute("aspect", thumb.aspect)
        if (thumb.season !== undefined) thumbEle.setAttribute("season", thumb.season.toString())
        if (thumb.type) thumbEle.setAttribute("type", thumb.type)
        tvshow.appendChild(thumbEle)
      })
    }
    const serializer = new XMLSerializer()
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + formatXml(serializer.serializeToString(doc))
  }

  static async fromXml(xml: string): Promise<NFO> {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "text/xml")
    const parseError = doc.querySelector("parsererror")
    if (parseError) throw new Error(`Failed to parse XML: ${parseError.textContent}`)
    const tvshow = doc.querySelector("tvshow")
    if (!tvshow) throw new Error("XML does not contain a tvshow root element")

    const nfo = new NFO()
    const getTextContent = (selector: string): string | undefined => {
      const element = tvshow.querySelector(selector)
      return element?.textContent?.trim() || undefined
    }
    nfo.id = getTextContent("id")
    nfo.title = getTextContent("title")
    nfo.originalTitle = getTextContent("originaltitle")
    nfo.showTitle = getTextContent("showtitle")
    nfo.plot = getTextContent("plot")
    nfo.fanart = getTextContent("fanart")
    nfo.tmdbid = getTextContent("tmdbid")
    nfo.tvdbid = getTextContent("tvdbid")
    const thumbElements = tvshow.querySelectorAll("thumb")
    if (thumbElements.length > 0) {
      nfo.thumbs = Array.from(thumbElements)
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
    return nfo
  }
}

export async function parseTvShowNfo(xml: string): Promise<TvShowNFO | undefined> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "text/xml")
  const parseError = doc.querySelector("parsererror")
  if (parseError) throw new Error(`Failed to parse XML: ${parseError.textContent}`)
  const tvshow = doc.querySelector("tvshow")
  if (!tvshow) return undefined

  const tvShowNfo: TvShowNFO = {}
  const getTextContent = (selector: string): string | undefined => {
    const element = tvshow.querySelector(selector)
    return element?.textContent?.trim() || undefined
  }
  tvShowNfo.title = getTextContent("title")
  tvShowNfo.originalTitle = getTextContent("originaltitle")
  tvShowNfo.showTitle = getTextContent("showtitle")
  tvShowNfo.sortTitle = getTextContent("sorttitle")
  tvShowNfo.year = parseIntField(getTextContent("year"))
  tvShowNfo.top250 = parseIntField(getTextContent("top250"))
  tvShowNfo.userRating = parseIntField(getTextContent("userrating"))
  tvShowNfo.outline = getTextContent("outline")
  tvShowNfo.plot = getTextContent("plot")
  tvShowNfo.tagline = getTextContent("tagline")
  tvShowNfo.runtime = parseIntField(getTextContent("runtime"))
  tvShowNfo.mpaa = getTextContent("mpaa")
  tvShowNfo.certification = getTextContent("certification")
  tvShowNfo.episodeguide = getTextContent("episodeguide")
  tvShowNfo.id = getTextContent("id")
  tvShowNfo.imdbid = getTextContent("imdbid")
  tvShowNfo.tmdbid = getTextContent("tmdbid")
  tvShowNfo.tvdbid = getTextContent("tvdbid")
  tvShowNfo.premiered = getTextContent("premiered")
  tvShowNfo.status = getTextContent("status")
  tvShowNfo.watched = parseBooleanField(getTextContent("watched"))
  tvShowNfo.playcount = parseIntField(getTextContent("playcount"))
  tvShowNfo.trailer = getTextContent("trailer")
  tvShowNfo.dateadded = getTextContent("dateadded")
  tvShowNfo.userNote = getTextContent("user_note")

  const thumbElements = Array.from(tvshow.children).filter((el): el is Element => el.tagName.toLowerCase() === "thumb")
  if (thumbElements.length > 0) {
    tvShowNfo.thumbs = thumbElements
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
  const collectTextList = (selector: string) =>
    Array.from(tvshow.querySelectorAll(selector))
      .map((el) => el.textContent?.trim() || undefined)
      .filter((v): v is string => v !== undefined && v !== "")

  tvShowNfo.fanartThumbs = collectTextList("fanart > thumb")
  const namedSeasonElements = tvshow.querySelectorAll("namedseason")
  if (namedSeasonElements.length > 0) {
    tvShowNfo.namedSeasons = Array.from(namedSeasonElements).map((el) => ({
      number: parseIntField(el.getAttribute("number") || undefined),
      name: el.textContent?.trim() || undefined,
    }))
  }
  const ratingElements = tvshow.querySelectorAll("ratings > rating")
  if (ratingElements.length > 0) {
    tvShowNfo.ratings = Array.from(ratingElements).map((ratingEl) => ({
      default: parseBooleanField(ratingEl.getAttribute("default") || undefined),
      max: parseIntField(ratingEl.getAttribute("max") || undefined),
      name: ratingEl.getAttribute("name") || undefined,
      value: parseFloatField(ratingEl.querySelector("value")?.textContent?.trim() || undefined),
      votes: parseIntField(ratingEl.querySelector("votes")?.textContent?.trim() || undefined),
    }))
  }
  const uniqueIdElements = tvshow.querySelectorAll("uniqueid")
  if (uniqueIdElements.length > 0) {
    tvShowNfo.uniqueIds = Array.from(uniqueIdElements).map((el) => ({
      default: parseBooleanField(el.getAttribute("default") || undefined),
      type: el.getAttribute("type") || undefined,
      value: el.textContent?.trim() || undefined,
    }))
  }
  const actors = tvshow.querySelectorAll("actor")
  if (actors.length > 0) {
    tvShowNfo.actors = Array.from(actors).map((actorEl) => ({
      name: actorEl.querySelector("name")?.textContent?.trim() || undefined,
      role: actorEl.querySelector("role")?.textContent?.trim() || undefined,
      thumb: actorEl.querySelector("thumb")?.textContent?.trim() || undefined,
      profile: actorEl.querySelector("profile")?.textContent?.trim() || undefined,
      tmdbid: actorEl.querySelector("tmdbid")?.textContent?.trim() || undefined,
    }))
  }
  tvShowNfo.genres = collectTextList("genre")
  tvShowNfo.studios = collectTextList("studio")
  tvShowNfo.countries = collectTextList("country")
  tvShowNfo.tags = collectTextList("tag")
  return tvShowNfo
}

export async function parseTvShowNFO(xml: string): Promise<TvShowNFO | undefined> {
  return parseTvShowNfo(xml)
}

export function convertTvShowNfoToXml(nfo: TvShowNFO): string {
  const doc = document.implementation.createDocument(null, "tvshow", null)
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
  addOptionalText("showtitle", nfo.showTitle)
  addOptionalText("sorttitle", nfo.sortTitle)
  addOptionalNumber("year", nfo.year)
  addOptionalNumber("top250", nfo.top250)
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
  addOptionalText("outline", nfo.outline)
  addOptionalText("plot", nfo.plot)
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
  nfo.namedSeasons?.forEach((namedSeason) => {
    const namedSeasonEl = doc.createElement("namedseason")
    if (namedSeason.number !== undefined) namedSeasonEl.setAttribute("number", String(namedSeason.number))
    if (namedSeason.name !== undefined) namedSeasonEl.textContent = namedSeason.name
    root.appendChild(namedSeasonEl)
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
  addOptionalText("episodeguide", nfo.episodeguide)
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
  addOptionalText("premiered", nfo.premiered)
  addOptionalText("status", nfo.status)
  if (nfo.watched !== undefined) addElement("watched", String(nfo.watched))
  addOptionalNumber("playcount", nfo.playcount)
  nfo.genres?.forEach((genre) => genre && addElement("genre", genre))
  nfo.studios?.forEach((studio) => studio && addElement("studio", studio))
  nfo.countries?.forEach((country) => country && addElement("country", country))
  nfo.tags?.forEach((tag) => tag && addElement("tag", tag))
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
  addOptionalText("trailer", nfo.trailer)
  addOptionalText("dateadded", nfo.dateadded)
  addOptionalText("user_note", nfo.userNote)

  const serializer = new XMLSerializer()
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + formatXml(serializer.serializeToString(doc))
}

export default NFO
