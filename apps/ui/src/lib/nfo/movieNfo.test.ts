import { describe, expect, it } from "vitest"
import { parseMovieNfo } from "./movieNfo"

describe("parseMovieNfo", () => {
  it("parses minimal movie nfo", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>My Movie</title>
  <originaltitle>My Original Movie</originaltitle>
  <year>2024</year>
  <tmdbid>123</tmdbid>
  <plot>Plot</plot>
  <outline>Outline</outline>
  <runtime>120</runtime>
</movie>`
    const nfo = await parseMovieNfo(xml)
    expect(nfo).toEqual({
      title: "My Movie",
      originalTitle: "My Original Movie",
      year: 2024,
      tmdbid: "123",
      plot: "Plot",
      outline: "Outline",
      runtime: 120,
    })
  })

  it("returns undefined when movie root is missing", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><tvshow><title>Test</title></tvshow>`
    const nfo = await parseMovieNfo(xml)
    expect(nfo).toBeUndefined()
  })

  it("throws when xml is invalid", async () => {
    const invalidXml = `<?xml version="1.0"?><movie><title>Test</title><unclosed-tag></movie>`
    await expect(parseMovieNfo(invalidXml)).rejects.toThrow("Failed to parse XML")
  })
})
