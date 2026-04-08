import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseMovieNfo } from "./movieNfo"

function resolveJesterMovieNfoPath(): string {
  const rel = "test/media/夺命小丑2_高清/夺命小丑2 (2025).nfo"
  const candidates = [resolve(process.cwd(), rel), resolve(process.cwd(), "../..", rel)]
  const matched = candidates.find((p) => existsSync(p))
  if (!matched) throw new Error(`Movie fixture not found. Tried: ${candidates.join(", ")}`)
  return matched
}

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

  it("parses tinyMediaManager movie fixture (夺命小丑2)", async () => {
    const xml = await readFile(resolveJesterMovieNfoPath(), "utf-8")
    const nfo = await parseMovieNfo(xml)
    expect(nfo).toBeDefined()
    expect(nfo!.title).toBe("夺命小丑2")
    expect(nfo!.originalTitle).toBe("The Jester 2")
    expect(nfo!.year).toBe(2025)
    expect(nfo!.tmdbid).toBe("1519168")
    expect(nfo!.id).toBe("tt37334010")
    expect(nfo!.set?.name).toBe("夺命小丑（系列）")
    expect(nfo!.ratings).toHaveLength(1)
    expect(nfo!.ratings![0]).toMatchObject({ name: "themoviedb", max: 10, value: 6.3, votes: 45 })
    expect(nfo!.uniqueIds).toHaveLength(3)
    expect(nfo!.uniqueIds!.find((u) => u.type === "imdb")?.value).toBe("tt37334010")
    expect(nfo!.thumbs).toHaveLength(2)
    expect(nfo!.thumbs!.find((t) => t.aspect === "poster")?.url).toContain("47dsw1jSOV0Be5zmy7CtLhYpqU.jpg")
    expect(nfo!.fanartThumbs).toHaveLength(1)
    expect(nfo!.genres).toEqual(["Horror", "Thriller", "Crime"])
    expect(nfo!.countries).toEqual(["美国"])
    expect(nfo!.studios).toEqual(["Traverse Terror", "Epic Pictures"])
    expect(nfo!.directors?.[0]).toMatchObject({ tmdbid: "2735733", name: "Colin Krawchuk" })
    expect(nfo!.credits?.[0]).toMatchObject({ tmdbid: "2735733", name: "Colin Krawchuk" })
    expect(nfo!.actors).toHaveLength(7)
    expect(nfo!.producers).toHaveLength(3)
    expect(nfo!.watched).toBe(false)
    expect(nfo!.playcount).toBe(0)
    expect(nfo!.userRating).toBe(0)
    expect(nfo!.top250).toBe(0)
    expect(nfo!.fileInfo?.streamDetails?.videos?.[0]).toMatchObject({
      width: 0,
      height: 0,
      aspect: 0,
      durationInSeconds: 0,
    })
    expect(nfo!.source).toBe("UNKNOWN")
    expect(nfo!.edition).toBe("NONE")
    expect(nfo!.originalFilename).toBe("夺命小丑2 (2025).mp4")
  })
})
