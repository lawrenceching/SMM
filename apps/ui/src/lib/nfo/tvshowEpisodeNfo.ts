import type { TMDBEpisode } from "@core/types"
import { getTMDBImageUrl } from "@/api/tmdb"
import type { TvShowNFOActor, TvShowNFORating, TvShowNFOUniqueId } from "./tvshowNfo"

export interface EpisodeNfo {
  id?: string
  title?: string
  originalTitle?: string
  showTitle?: string
  season?: number
  episode?: number
  uniqueIds?: TvShowNFOUniqueId[]
  ratings?: TvShowNFORating[]
  userRating?: number
  plot?: string
  runtime?: number
  thumb?: string
  mpaa?: string
  premiered?: string
  aired?: string
  watched?: boolean
  playcount?: number
  studios?: string[]
  credits?: Array<{ tmdbid?: string; name?: string }>
  directors?: Array<{ tmdbid?: string; name?: string }>
  actors?: TvShowNFOActor[]
  dateadded?: string
  source?: string
  edition?: string
  originalFilename?: string
  userNote?: string
  episodeGroups?: Array<{ id?: string; name?: string; season?: number; episode?: number }>
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

function formatEpisodeNfoXml(xml: string): string {
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

export async function parseEpisodeNfo(xml: string): Promise<EpisodeNfo | undefined> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "text/xml")
  const parseError = doc.querySelector("parsererror")
  if (parseError) throw new Error(`Failed to parse XML: ${parseError.textContent}`)
  const episode = doc.querySelector("episodedetails")
  if (!episode) return undefined
  const episodeNfo: EpisodeNfo = {}
  const getTextContent = (selector: string): string | undefined => {
    const element = episode.querySelector(selector)
    return element?.textContent?.trim() || undefined
  }
  episodeNfo.id = getTextContent("id")
  episodeNfo.title = getTextContent("title")
  episodeNfo.originalTitle = getTextContent("originaltitle")
  episodeNfo.showTitle = getTextContent("showtitle")
  episodeNfo.plot = getTextContent("plot")
  episodeNfo.thumb = getTextContent("thumb")
  episodeNfo.mpaa = getTextContent("mpaa")
  episodeNfo.premiered = getTextContent("premiered")
  episodeNfo.aired = getTextContent("aired")
  episodeNfo.dateadded = getTextContent("dateadded")
  episodeNfo.source = getTextContent("source")
  episodeNfo.edition = getTextContent("edition")
  episodeNfo.originalFilename = getTextContent("original_filename")
  episodeNfo.userNote = getTextContent("user_note")
  episodeNfo.season = parseIntField(getTextContent("season"))
  episodeNfo.episode = parseIntField(getTextContent("episode"))
  episodeNfo.userRating = parseIntField(getTextContent("userrating"))
  episodeNfo.runtime = parseIntField(getTextContent("runtime"))
  episodeNfo.playcount = parseIntField(getTextContent("playcount"))
  episodeNfo.watched = parseBooleanField(getTextContent("watched"))

  const uniqueIdElements = episode.querySelectorAll("uniqueid")
  if (uniqueIdElements.length > 0) {
    episodeNfo.uniqueIds = Array.from(uniqueIdElements).map((el) => ({
      default: parseBooleanField(el.getAttribute("default") || undefined),
      type: el.getAttribute("type") || undefined,
      value: el.textContent?.trim() || undefined,
    }))
  }
  const ratingElements = episode.querySelectorAll("ratings > rating")
  if (ratingElements.length > 0) {
    episodeNfo.ratings = Array.from(ratingElements).map((ratingEl) => ({
      default: parseBooleanField(ratingEl.getAttribute("default") || undefined),
      max: parseIntField(ratingEl.getAttribute("max") || undefined),
      name: ratingEl.getAttribute("name") || undefined,
      value: parseFloatField(ratingEl.querySelector("value")?.textContent?.trim() || undefined),
      votes: parseIntField(ratingEl.querySelector("votes")?.textContent?.trim() || undefined),
    }))
  }
  const collectTexts = (selector: string) =>
    Array.from(episode.querySelectorAll(selector))
      .map((el) => el.textContent?.trim() || undefined)
      .filter((v): v is string => v !== undefined && v !== "")
  episodeNfo.studios = collectTexts("studio")
  const creditsElements = episode.querySelectorAll("credits")
  if (creditsElements.length > 0) {
    episodeNfo.credits = Array.from(creditsElements).map((el) => ({
      tmdbid: el.getAttribute("tmdbid") || undefined,
      name: el.textContent?.trim() || undefined,
    }))
  }
  const directorElements = episode.querySelectorAll("director")
  if (directorElements.length > 0) {
    episodeNfo.directors = Array.from(directorElements).map((el) => ({
      tmdbid: el.getAttribute("tmdbid") || undefined,
      name: el.textContent?.trim() || undefined,
    }))
  }
  const actorElements = episode.querySelectorAll("actor")
  if (actorElements.length > 0) {
    episodeNfo.actors = Array.from(actorElements).map((actorEl) => ({
      name: actorEl.querySelector("name")?.textContent?.trim() || undefined,
      role: actorEl.querySelector("role")?.textContent?.trim() || undefined,
      thumb: actorEl.querySelector("thumb")?.textContent?.trim() || undefined,
      profile: actorEl.querySelector("profile")?.textContent?.trim() || undefined,
      type: actorEl.querySelector("type")?.textContent?.trim() || undefined,
      tmdbid: actorEl.querySelector("tmdbid")?.textContent?.trim() || undefined,
    }))
  }
  const groupElements = episode.querySelectorAll("episode_groups > group")
  if (groupElements.length > 0) {
    episodeNfo.episodeGroups = Array.from(groupElements).map((groupEl) => ({
      id: groupEl.getAttribute("id") || undefined,
      name: groupEl.getAttribute("name") || undefined,
      season: parseIntField(groupEl.getAttribute("season") || undefined),
      episode: parseIntField(groupEl.getAttribute("episode") || undefined),
    }))
  }
  return episodeNfo
}

export async function parseTvShowEpisodeNfo(xml: string): Promise<EpisodeNfo | undefined> {
  return parseEpisodeNfo(xml)
}

export function buildEpisodeNfoXml(episode: TMDBEpisode, originalFilename: string): string {
  const doc = document.implementation.createDocument(null, "episodedetails", null)
  const root = doc.documentElement
  const addElement = (name: string, value: string) => {
    const el = doc.createElement(name)
    el.textContent = value
    root.appendChild(el)
  }
  if (episode.name) addElement("title", episode.name)
  if (episode.overview) addElement("plot", episode.overview)
  if (episode.still_path) {
    const thumbUrl = getTMDBImageUrl(episode.still_path, "original")
    if (thumbUrl) addElement("thumb", thumbUrl)
  }
  if (episode.air_date) addElement("premiered", episode.air_date)
  addElement("episode", String(episode.episode_number))
  addElement("season", String(episode.season_number))
  addElement("original_filename", originalFilename)
  const uniqueId = doc.createElement("uniqueid")
  uniqueId.setAttribute("type", "tmdb")
  uniqueId.textContent = String(episode.id)
  root.appendChild(uniqueId)
  if (episode.id) addElement("id", String(episode.id))
  if (episode.runtime > 0) addElement("runtime", String(episode.runtime))
  if (episode.vote_average > 0 || episode.vote_count > 0) {
    const ratings = doc.createElement("ratings")
    const rating = doc.createElement("rating")
    rating.setAttribute("name", "themoviedb")
    const value = doc.createElement("value")
    value.textContent = String(episode.vote_average)
    const votes = doc.createElement("votes")
    votes.textContent = String(episode.vote_count)
    rating.appendChild(value)
    rating.appendChild(votes)
    ratings.appendChild(rating)
    root.appendChild(ratings)
  }
  const serializer = new XMLSerializer()
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + formatEpisodeNfoXml(serializer.serializeToString(doc))
}

export function convertTvShowEpisodeNfoToXml(nfo: EpisodeNfo): string {
  const doc = document.implementation.createDocument(null, "episodedetails", null)
  const root = doc.documentElement
  const addElement = (name: string, value: string) => {
    const el = doc.createElement(name)
    el.textContent = value
    root.appendChild(el)
  }
  const addOptionalText = (name: string, value: string | undefined) => value !== undefined && addElement(name, value)
  const addOptionalNumber = (name: string, value: number | undefined) => value !== undefined && addElement(name, String(value))
  addOptionalText("title", nfo.title)
  addOptionalText("originaltitle", nfo.originalTitle)
  addOptionalText("showtitle", nfo.showTitle)
  addOptionalNumber("season", nfo.season)
  addOptionalNumber("episode", nfo.episode)
  addOptionalText("id", nfo.id)
  nfo.uniqueIds?.forEach((uniqueId) => {
    const uniqueIdEl = doc.createElement("uniqueid")
    if (uniqueId.default !== undefined) uniqueIdEl.setAttribute("default", String(uniqueId.default))
    if (uniqueId.type) uniqueIdEl.setAttribute("type", uniqueId.type)
    if (uniqueId.value !== undefined) uniqueIdEl.textContent = uniqueId.value
    root.appendChild(uniqueIdEl)
  })
  if (nfo.ratings?.length) {
    const ratingsEl = doc.createElement("ratings")
    nfo.ratings.forEach((r) => {
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
    })
    root.appendChild(ratingsEl)
  }
  addOptionalNumber("userrating", nfo.userRating)
  addOptionalText("plot", nfo.plot)
  addOptionalNumber("runtime", nfo.runtime)
  addOptionalText("thumb", nfo.thumb)
  addOptionalText("mpaa", nfo.mpaa)
  addOptionalText("premiered", nfo.premiered)
  addOptionalText("aired", nfo.aired)
  if (nfo.watched !== undefined) addElement("watched", String(nfo.watched))
  addOptionalNumber("playcount", nfo.playcount)
  nfo.studios?.forEach((studio) => studio && addElement("studio", studio))
  nfo.credits?.forEach((credit) => {
    const creditEl = doc.createElement("credits")
    if (credit.tmdbid) creditEl.setAttribute("tmdbid", credit.tmdbid)
    if (credit.name !== undefined) creditEl.textContent = credit.name
    root.appendChild(creditEl)
  })
  nfo.directors?.forEach((director) => {
    const directorEl = doc.createElement("director")
    if (director.tmdbid) directorEl.setAttribute("tmdbid", director.tmdbid)
    if (director.name !== undefined) directorEl.textContent = director.name
    root.appendChild(directorEl)
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
    if (actor.type !== undefined) {
      const el = doc.createElement("type")
      el.textContent = actor.type
      actorEl.appendChild(el)
    }
    if (actor.tmdbid !== undefined) {
      const el = doc.createElement("tmdbid")
      el.textContent = actor.tmdbid
      actorEl.appendChild(el)
    }
    root.appendChild(actorEl)
  })
  addOptionalText("dateadded", nfo.dateadded)
  addOptionalText("source", nfo.source)
  addOptionalText("edition", nfo.edition)
  addOptionalText("original_filename", nfo.originalFilename)
  addOptionalText("user_note", nfo.userNote)
  if (nfo.episodeGroups?.length) {
    const episodeGroupsEl = doc.createElement("episode_groups")
    nfo.episodeGroups.forEach((group) => {
      const groupEl = doc.createElement("group")
      if (group.episode !== undefined) groupEl.setAttribute("episode", String(group.episode))
      if (group.id !== undefined) groupEl.setAttribute("id", group.id)
      if (group.name !== undefined) groupEl.setAttribute("name", group.name)
      if (group.season !== undefined) groupEl.setAttribute("season", String(group.season))
      episodeGroupsEl.appendChild(groupEl)
    })
    root.appendChild(episodeGroupsEl)
  }
  const serializer = new XMLSerializer()
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + formatEpisodeNfoXml(serializer.serializeToString(doc))
}
