import type { EpisodeNfo, MovieNFO, TvShowNFO } from "./nfoTypes";

interface XmlNode {
  tag: string;
  attrs?: Record<string, string | undefined>;
  text?: string;
  children?: XmlNode[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function serializeNode(node: XmlNode): string {
  const attrs = node.attrs
    ? Object.entries(node.attrs)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ` ${key}="${escapeXml(String(value))}"`)
        .join("")
    : "";

  if (!node.children?.length && node.text === undefined) {
    return `<${node.tag}${attrs}/>`;
  }

  const inner =
    node.text !== undefined
      ? escapeXml(node.text)
      : (node.children ?? []).map(serializeNode).join("");
  return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

function formatXml(xml: string): string {
  const padding = "  ";
  const reg = /(>)(<)(\/*)/g;
  let formatted = "";
  xml = xml.replace(reg, "$1\n$2$3");
  let pad = 0;
  xml.split("\n").forEach((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad > 0) pad -= 1;
    } else if (node.match(/^<\w([^>]*[^/])?>.*$/)) {
      indent = 1;
    }
    formatted += padding.repeat(pad) + node + "\n";
    pad += indent;
  });
  return formatted.trim();
}

function textElement(tag: string, value: string | undefined): XmlNode | undefined {
  if (value === undefined) return undefined;
  return { tag, text: value };
}

function numberElement(tag: string, value: number | undefined): XmlNode | undefined {
  if (value === undefined) return undefined;
  return { tag, text: String(value) };
}

function buildTvShowChildren(nfo: TvShowNFO): XmlNode[] {
  const children: XmlNode[] = [];

  for (const node of [
    textElement("title", nfo.title),
    textElement("originaltitle", nfo.originalTitle),
    textElement("showtitle", nfo.showTitle),
    textElement("sorttitle", nfo.sortTitle),
    numberElement("year", nfo.year),
    numberElement("top250", nfo.top250),
  ]) {
    if (node) children.push(node);
  }

  if (nfo.ratings?.length) {
    children.push({
      tag: "ratings",
      children: nfo.ratings.map((rating) => ({
        tag: "rating",
        attrs: {
          default: rating.default !== undefined ? String(rating.default) : undefined,
          max: rating.max !== undefined ? String(rating.max) : undefined,
          name: rating.name,
        },
        children: [
          ...(rating.value !== undefined
            ? [{ tag: "value", text: String(rating.value) }]
            : []),
          ...(rating.votes !== undefined
            ? [{ tag: "votes", text: String(rating.votes) }]
            : []),
        ],
      })),
    });
  }

  for (const node of [
    numberElement("userrating", nfo.userRating),
    textElement("outline", nfo.outline),
    textElement("plot", nfo.plot),
    textElement("tagline", nfo.tagline),
    numberElement("runtime", nfo.runtime),
  ]) {
    if (node) children.push(node);
  }

  nfo.thumbs?.forEach((thumb) => {
    if (!thumb.url) return;
    children.push({
      tag: "thumb",
      attrs: {
        aspect: thumb.aspect ?? undefined,
        season: thumb.season !== undefined ? String(thumb.season) : undefined,
        type: thumb.type,
      },
      text: thumb.url,
    });
  });

  nfo.namedSeasons?.forEach((namedSeason) => {
    children.push({
      tag: "namedseason",
      attrs: {
        number:
          namedSeason.number !== undefined ? String(namedSeason.number) : undefined,
      },
      text: namedSeason.name,
    });
  });

  if (nfo.fanartThumbs?.length) {
    children.push({
      tag: "fanart",
      children: nfo.fanartThumbs
        .filter(Boolean)
        .map((thumbUrl) => ({ tag: "thumb", text: thumbUrl })),
    });
  }

  for (const node of [
    textElement("mpaa", nfo.mpaa),
    textElement("certification", nfo.certification),
    textElement("episodeguide", nfo.episodeguide),
    textElement("id", nfo.id),
    textElement("imdbid", nfo.imdbid),
    textElement("tmdbid", nfo.tmdbid),
    textElement("tvdbid", nfo.tvdbid),
  ]) {
    if (node) children.push(node);
  }

  nfo.uniqueIds?.forEach((uniqueId) => {
    children.push({
      tag: "uniqueid",
      attrs: {
        default: uniqueId.default !== undefined ? String(uniqueId.default) : undefined,
        type: uniqueId.type,
      },
      text: uniqueId.value,
    });
  });

  for (const node of [
    textElement("premiered", nfo.premiered),
    textElement("status", nfo.status),
    nfo.watched !== undefined ? { tag: "watched", text: String(nfo.watched) } : undefined,
    numberElement("playcount", nfo.playcount),
  ]) {
    if (node) children.push(node);
  }

  nfo.genres?.forEach((genre) => {
    if (genre) children.push({ tag: "genre", text: genre });
  });
  nfo.studios?.forEach((studio) => {
    if (studio) children.push({ tag: "studio", text: studio });
  });
  nfo.countries?.forEach((country) => {
    if (country) children.push({ tag: "country", text: country });
  });
  nfo.tags?.forEach((tag) => {
    if (tag) children.push({ tag: "tag", text: tag });
  });

  nfo.actors?.forEach((actor) => {
    children.push({
      tag: "actor",
      children: [
        ...(actor.name !== undefined ? [{ tag: "name", text: actor.name }] : []),
        ...(actor.role !== undefined ? [{ tag: "role", text: actor.role }] : []),
        ...(actor.thumb !== undefined ? [{ tag: "thumb", text: actor.thumb }] : []),
        ...(actor.profile !== undefined ? [{ tag: "profile", text: actor.profile }] : []),
        ...(actor.tmdbid !== undefined ? [{ tag: "tmdbid", text: actor.tmdbid }] : []),
      ],
    });
  });

  for (const node of [
    textElement("trailer", nfo.trailer),
    textElement("dateadded", nfo.dateadded),
    textElement("user_note", nfo.userNote),
  ]) {
    if (node) children.push(node);
  }

  return children;
}

function buildEpisodeChildren(nfo: EpisodeNfo): XmlNode[] {
  const children: XmlNode[] = [];

  for (const node of [
    textElement("title", nfo.title),
    textElement("originaltitle", nfo.originalTitle),
    textElement("showtitle", nfo.showTitle),
    numberElement("season", nfo.season),
    numberElement("episode", nfo.episode),
    textElement("id", nfo.id),
  ]) {
    if (node) children.push(node);
  }

  nfo.uniqueIds?.forEach((uniqueId) => {
    children.push({
      tag: "uniqueid",
      attrs: {
        default: uniqueId.default !== undefined ? String(uniqueId.default) : undefined,
        type: uniqueId.type,
      },
      text: uniqueId.value,
    });
  });

  if (nfo.ratings?.length) {
    children.push({
      tag: "ratings",
      children: nfo.ratings.map((rating) => ({
        tag: "rating",
        attrs: {
          default: rating.default !== undefined ? String(rating.default) : undefined,
          max: rating.max !== undefined ? String(rating.max) : undefined,
          name: rating.name,
        },
        children: [
          ...(rating.value !== undefined
            ? [{ tag: "value", text: String(rating.value) }]
            : []),
          ...(rating.votes !== undefined
            ? [{ tag: "votes", text: String(rating.votes) }]
            : []),
        ],
      })),
    });
  }

  for (const node of [
    numberElement("userrating", nfo.userRating),
    textElement("plot", nfo.plot),
    numberElement("runtime", nfo.runtime),
    textElement("thumb", nfo.thumb),
    textElement("mpaa", nfo.mpaa),
    textElement("premiered", nfo.premiered),
    textElement("aired", nfo.aired),
    nfo.watched !== undefined ? { tag: "watched", text: String(nfo.watched) } : undefined,
    numberElement("playcount", nfo.playcount),
  ]) {
    if (node) children.push(node);
  }

  nfo.studios?.forEach((studio) => {
    if (studio) children.push({ tag: "studio", text: studio });
  });

  nfo.credits?.forEach((credit) => {
    children.push({
      tag: "credits",
      attrs: { tmdbid: credit.tmdbid },
      text: credit.name,
    });
  });

  nfo.directors?.forEach((director) => {
    children.push({
      tag: "director",
      attrs: { tmdbid: director.tmdbid },
      text: director.name,
    });
  });

  nfo.actors?.forEach((actor) => {
    children.push({
      tag: "actor",
      children: [
        ...(actor.name !== undefined ? [{ tag: "name", text: actor.name }] : []),
        ...(actor.role !== undefined ? [{ tag: "role", text: actor.role }] : []),
        ...(actor.thumb !== undefined ? [{ tag: "thumb", text: actor.thumb }] : []),
        ...(actor.profile !== undefined ? [{ tag: "profile", text: actor.profile }] : []),
        ...(actor.type !== undefined ? [{ tag: "type", text: actor.type }] : []),
        ...(actor.tmdbid !== undefined ? [{ tag: "tmdbid", text: actor.tmdbid }] : []),
      ],
    });
  });

  for (const node of [
    textElement("dateadded", nfo.dateadded),
    textElement("source", nfo.source),
    textElement("edition", nfo.edition),
    textElement("original_filename", nfo.originalFilename),
    textElement("user_note", nfo.userNote),
  ]) {
    if (node) children.push(node);
  }

  if (nfo.episodeGroups?.length) {
    children.push({
      tag: "episode_groups",
      children: nfo.episodeGroups.map((group) => ({
        tag: "group",
        attrs: {
          episode: group.episode !== undefined ? String(group.episode) : undefined,
          id: group.id,
          name: group.name,
          season: group.season !== undefined ? String(group.season) : undefined,
        },
      })),
    });
  }

  return children;
}

function toXmlDocument(rootTag: string, children: XmlNode[]): string {
  const body = serializeNode({ tag: rootTag, children });
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + formatXml(body)
  );
}

export function convertTvShowNfoToXml(nfo: TvShowNFO): string {
  return toXmlDocument("tvshow", buildTvShowChildren(nfo));
}

export function convertTvShowEpisodeNfoToXml(nfo: EpisodeNfo): string {
  return toXmlDocument("episodedetails", buildEpisodeChildren(nfo));
}

function buildMovieChildren(nfo: MovieNFO): XmlNode[] {
  const children: XmlNode[] = [];
  for (const node of [
    textElement("title", nfo.title),
    textElement("originaltitle", nfo.originalTitle),
    textElement("sorttitle", nfo.sortTitle),
    textElement("year", nfo.year !== undefined ? String(nfo.year) : undefined),
    textElement("plot", nfo.plot),
    textElement("outline", nfo.outline),
    textElement("tagline", nfo.tagline),
    textElement("runtime", nfo.runtime !== undefined ? String(nfo.runtime) : undefined),
    textElement("id", nfo.id),
    textElement("imdbid", nfo.imdbid),
    textElement("tmdbid", nfo.tmdbid),
    textElement("tvdbid", nfo.tvdbid),
    textElement("premiered", nfo.premiered),
    textElement("status", nfo.status),
    textElement("languages", nfo.languages),
    textElement("dateadded", nfo.dateadded),
  ]) {
    if (node) children.push(node);
  }

  if (nfo.ratings?.length) {
    children.push({
      tag: "ratings",
      children: nfo.ratings.map((r) => ({
        tag: "rating",
        attrs: {
          default: r.default !== undefined ? String(r.default) : undefined,
          max: r.max !== undefined ? String(r.max) : undefined,
          name: r.name,
        },
        children: [
          ...(r.value !== undefined ? [{ tag: "value", text: String(r.value) }] : []),
          ...(r.votes !== undefined ? [{ tag: "votes", text: String(r.votes) }] : []),
        ],
      })),
    });
  }

  nfo.thumbs?.forEach((thumb) => {
    if (!thumb.url) return;
    children.push({
      tag: "thumb",
      text: thumb.url,
      attrs: {
        aspect: thumb.aspect ?? undefined,
        season: thumb.season !== undefined ? String(thumb.season) : undefined,
        type: thumb.type,
      },
    });
  });

  if (nfo.fanartThumbs?.length) {
    children.push({
      tag: "fanart",
      children: nfo.fanartThumbs.map((url) => ({ tag: "thumb", text: url })),
    });
  }

  nfo.uniqueIds?.forEach((uid) => {
    children.push({
      tag: "uniqueid",
      text: uid.value,
      attrs: {
        type: uid.type,
        default: uid.default !== undefined ? String(uid.default) : undefined,
      },
    });
  });

  nfo.genres?.forEach((genre) => children.push({ tag: "genre", text: genre }));
  nfo.studios?.forEach((studio) => children.push({ tag: "studio", text: studio }));
  nfo.countries?.forEach((country) => children.push({ tag: "country", text: country }));

  return children;
}

export function convertMovieNfoToXml(nfo: MovieNFO): string {
  return toXmlDocument("movie", buildMovieChildren(nfo));
}

export type { EpisodeNfo, MovieNFO, TvShowNFO } from "./nfoTypes";
