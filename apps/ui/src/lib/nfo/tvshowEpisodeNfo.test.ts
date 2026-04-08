import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  convertTvShowEpisodeNfoToXml,
  parseEpisodeNfo,
  parseTvShowEpisodeNfo,
} from "./tvshowEpisodeNfo"

function resolveTvShowEpisodeExampleNfoPath(): string {
  const candidates = [
    resolve(process.cwd(), "docs/tvshow-epsiode.nfo"),
    resolve(process.cwd(), "../../docs/tvshow-epsiode.nfo"),
  ]
  const matched = candidates.find((p) => existsSync(p))
  if (!matched) throw new Error(`tvshow-epsiode.nfo not found. Tried: ${candidates.join(", ")}`)
  return matched
}

describe("parseEpisodeNfo", () => {
  it("parses minimal episode nfo", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>Test Episode</title>
  <season>2</season>
  <episode>5</episode>
</episodedetails>`
    const episodeNfo = await parseEpisodeNfo(xml)
    expect(episodeNfo?.title).toBe("Test Episode")
    expect(episodeNfo?.season).toBe(2)
    expect(episodeNfo?.episode).toBe(5)
  })

  it("throws for invalid xml", async () => {
    const invalidXml = `<?xml version="1.0"?><episodedetails><title>Test</title><unclosed-tag></episodedetails>`
    await expect(parseEpisodeNfo(invalidXml)).rejects.toThrow("Failed to parse XML")
  })

  it("returns undefined when episodedetails is missing", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><tvshow><title>Test</title></tvshow>`
    const episodeNfo = await parseEpisodeNfo(xml)
    expect(episodeNfo).toBeUndefined()
  })
})

describe("TvShowEpisodeNfo parse/convert", () => {
  it("parseTvShowEpisodeNfo parses fixture", async () => {
    const xml = await readFile(resolveTvShowEpisodeExampleNfoPath(), "utf-8")
    const nfo = await parseTvShowEpisodeNfo(xml)
    expect(nfo).toBeDefined()
    expect(nfo?.title).toBe("交流01「我想说话」")
    expect(nfo?.season).toBe(1)
    expect(nfo?.episode).toBe(1)
    expect(nfo?.id).toBe("8415207")
    expect(nfo?.ratings?.[0]).toMatchObject({ name: "themoviedb", value: 7.8, votes: 13 })
  })

  it("convertTvShowEpisodeNfoToXml round-trips fixture baseline", async () => {
    const xml = await readFile(resolveTvShowEpisodeExampleNfoPath(), "utf-8")
    const baseline = await parseTvShowEpisodeNfo(xml)
    expect(baseline).toBeDefined()
    const convertedXml = convertTvShowEpisodeNfoToXml(baseline!)
    const reparsed = await parseTvShowEpisodeNfo(convertedXml)
    expect(reparsed).toEqual(baseline)
  })
})
