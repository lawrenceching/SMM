import { describe, expect, it, vi } from "vitest"
import type { MediaMetadata } from "@smm/types"
import { defaultUserConfig } from "@/api/readUserConfig"
import { downloadScrapeImage } from "./downloadScrapeImage"

const movie: MediaMetadata = {
  type: "movie-folder",
  mediaFolderPath: "/media/Fight Club",
  movie: { id: "550", database: "TMDB", name: "Fight Club" },
} as MediaMetadata

describe("downloadScrapeImage", () => {
  it("downloads through the configured tmdb proxy", async () => {
    const download = vi.fn().mockResolvedValue({ data: { url: "u", path: "/p" } })
    const uc = {
      ...defaultUserConfig,
      tmdb: { host: "https://api.themoviedb.org", apiKey: "", httpProxy: "http://proxy:8080" },
    }
    await downloadScrapeImage(movie, "https://image.tmdb.org/x.jpg", "/media/poster.jpg", uc, {
      downloadImageWithFailover: download,
    })
    expect(download).toHaveBeenCalledWith("https://image.tmdb.org/x.jpg", "/media/poster.jpg", {
      httpProxy: "http://proxy:8080",
    })
  })

  it("downloads directly when no proxy is configured", async () => {
    const download = vi.fn().mockResolvedValue({ data: { url: "u", path: "/p" } })
    const uc = { ...defaultUserConfig, tmdb: { host: "", apiKey: "", httpProxy: "" } }
    await downloadScrapeImage(movie, "https://image.tmdb.org/x.jpg", "/media/poster.jpg", uc, {
      downloadImageWithFailover: download,
    })
    expect(download).toHaveBeenCalledWith("https://image.tmdb.org/x.jpg", "/media/poster.jpg", {
      httpProxy: undefined,
    })
  })

  it("throws when the download fails", async () => {
    const download = vi.fn().mockResolvedValue({
      data: { url: "u", path: "/p" },
      error: "HTTP error! status: 503",
    })
    const uc = { ...defaultUserConfig }
    await expect(
      downloadScrapeImage(movie, "https://image.tmdb.org/x.jpg", "/media/poster.jpg", uc, {
        downloadImageWithFailover: download,
      }),
    ).rejects.toThrow("HTTP error! status: 503")
  })
})
