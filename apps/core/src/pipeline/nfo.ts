export interface ParsedNfo {
  title?: string;
  tmdbid?: string;
  tvdbid?: string;
}

function textOf(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (match === null) return undefined;
  const value = match[1]?.trim();
  return value === "" ? undefined : value;
}

/**
 * Runtime-agnostic regex NFO parser. The existing UI parser uses DOMParser
 * (browser-only); core needs the ids (and title) without a DOM.
 */
export function parseNfo(xml: string): ParsedNfo {
  return {
    title: textOf(xml, "title"),
    tmdbid: textOf(xml, "tmdbid"),
    tvdbid: textOf(xml, "tvdbid"),
  };
}
