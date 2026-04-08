import { describe, expect, it } from "vitest"
import NFO, {
  buildEpisodeNfoXml,
  convertTvShowEpisodeNfoToXml,
  convertTvShowNfoToXml,
  parseEpisodeNfo,
  parseMovieNfo,
  parseTvShowEpisodeNfo,
  parseTvShowNFO,
} from "./nfo"

describe("nfo.ts compatibility shim exports", () => {
  it("re-exports default NFO class", () => {
    const nfo = new NFO()
    expect(nfo).toBeInstanceOf(NFO)
  })

  it("re-exports all parser/converter APIs", () => {
    expect(typeof parseTvShowNFO).toBe("function")
    expect(typeof convertTvShowNfoToXml).toBe("function")
    expect(typeof parseEpisodeNfo).toBe("function")
    expect(typeof parseTvShowEpisodeNfo).toBe("function")
    expect(typeof convertTvShowEpisodeNfoToXml).toBe("function")
    expect(typeof buildEpisodeNfoXml).toBe("function")
    expect(typeof parseMovieNfo).toBe("function")
  })
})
