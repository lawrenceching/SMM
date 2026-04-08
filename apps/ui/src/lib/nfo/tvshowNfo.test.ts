import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { NFO, convertTvShowNfoToXml, parseTvShowNFO } from "./tvshowNfo"

function resolveTvShowExampleNfoPath(): string {
  const candidates = [
    resolve(process.cwd(), "docs/tvshow-example.nfo"),
    resolve(process.cwd(), "../../docs/tvshow-example.nfo"),
  ]
  const matched = candidates.find((p) => existsSync(p))
  if (!matched) throw new Error(`tvshow-example.nfo not found. Tried: ${candidates.join(", ")}`)
  return matched
}

describe("NFO class", () => {
  it("creates an empty instance", () => {
    const nfo = new NFO()
    expect(nfo.id).toBeUndefined()
    expect(nfo.title).toBeUndefined()
    expect(nfo.originalTitle).toBeUndefined()
    expect(nfo.showTitle).toBeUndefined()
    expect(nfo.plot).toBeUndefined()
    expect(nfo.thumbs).toBeUndefined()
    expect(nfo.fanart).toBeUndefined()
    expect(nfo.tmdbid).toBeUndefined()
  })

  it("serializes core fields and thumb attributes", () => {
    const nfo = new NFO()
    nfo.id = "123"
    nfo.title = "Test Show"
    nfo.originalTitle = "Original"
    nfo.showTitle = "Show"
    nfo.plot = "Plot"
    nfo.fanart = "Fanart"
    nfo.tmdbid = "999"
    nfo.thumbs = [{ url: "https://x/y.jpg", aspect: "poster", season: 1, type: "season" }]
    const xml = nfo.toXML()
    expect(xml).toContain("<id>123</id>")
    expect(xml).toContain('<thumb aspect="poster" season="1" type="season">https://x/y.jpg</thumb>')
  })

  it("parses class xml", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <id>123876</id>
  <title>古见同学有交流障碍症</title>
  <originaltitle>古見さんは、コミュ症です。</originaltitle>
  <showtitle>古见同学有交流障碍症</showtitle>
  <plot>plot</plot>
  <fanart>https://image.tmdb.org/t/p/w1280/fan.jpg</fanart>
  <tmdbid>123876</tmdbid>
  <thumb aspect="poster">https://image.tmdb.org/t/p/w500/a.jpg</thumb>
</tvshow>`
    const nfo = await NFO.fromXml(xml)
    expect(nfo.id).toBe("123876")
    expect(nfo.thumbs?.[0].aspect).toBe("poster")
  })
})

describe("TvShowNFO parse/convert", () => {
  it("parseTvShowNFO parses tvshow-example fixture", async () => {
    const xml = await readFile(resolveTvShowExampleNfoPath(), "utf-8")
    const nfo = await parseTvShowNFO(xml)
    expect(nfo).toBeDefined()
    expect(nfo?.title).toBe("古见同学有交流障碍症")
    expect(nfo?.tmdbid).toBe("123876")
    expect(nfo?.tvdbid).toBe("402412")
    expect(nfo?.imdbid).toBe("tt14626352")
    expect(nfo?.ratings?.[0]).toMatchObject({ name: "themoviedb", value: 8.3, votes: 545 })
  })

  it("convertTvShowNfoToXml round-trips fixture baseline", async () => {
    const xml = await readFile(resolveTvShowExampleNfoPath(), "utf-8")
    const baseline = await parseTvShowNFO(xml)
    expect(baseline).toBeDefined()
    const convertedXml = convertTvShowNfoToXml(baseline!)
    const reparsed = await parseTvShowNFO(convertedXml)
    expect(reparsed).toEqual(baseline)
  })

  it("converts and parses explicit tvdbid field", async () => {
    const xml = convertTvShowNfoToXml({
      title: "TVDB Show",
      id: "402412",
      tvdbid: "402412",
      uniqueIds: [{ type: "tvdb", value: "402412", default: true }],
    })
    expect(xml).toContain("<tvdbid>402412</tvdbid>")
    const reparsed = await parseTvShowNFO(xml)
    expect(reparsed?.tvdbid).toBe("402412")
  })
})
