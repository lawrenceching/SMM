import { describe, it, expect } from "vitest"
import { generateNewFileName } from "./renameRules"

describe("generateNewFileName", () => {
  describe("Plex rename rules", () => {
    describe("movie", () => {
      it("should generate filename for movie with year", () => {
        const result = generateNewFileName("plex", {
          type: "movie",
          seasonNumber: 0,
          episodeNumber: 0,
          movieName: "The Matrix",
          file: "The.Matrix.1999.mkv",
          releaseYear: "1999",
        })

        expect(result).toBe("The Matrix (1999).mkv")
      })

      it("should generate filename for movie without year", () => {
        const result = generateNewFileName("plex", {
          type: "movie",
          seasonNumber: 0,
          episodeNumber: 0,
          movieName: "Inception",
          file: "Inception.mkv",
          releaseYear: "",
        })

        expect(result).toBe("Inception.mkv")
      })
    })

    describe("tvshow", () => {
      it("should generate filename for tv show episode", () => {
        const result = generateNewFileName("plex", {
          type: "tv",
          seasonNumber: 1,
          episodeNumber: 5,
          episodeName: "Enter the Matrix",
          tvshowName: "The Matrix",
          file: "S01E05.mkv",
          releaseYear: "",
        })

        expect(result).toBe("Season 01/The Matrix - S01E05 - Enter the Matrix.mkv")
      })

      it("should pad season and episode numbers with zeros", () => {
        const result = generateNewFileName("plex", {
          type: "tv",
          seasonNumber: 2,
          episodeNumber: 10,
          episodeName: "Test Episode",
          tvshowName: "Test Show",
          file: "S02E10.mkv",
          releaseYear: "",
        })

        expect(result).toBe("Season 02/Test Show - S02E10 - Test Episode.mkv")
      })
    })
  })

  describe("Emby rename rules", () => {
    describe("movie", () => {
      it("should generate filename for movie with year", () => {
        const result = generateNewFileName("emby", {
          type: "movie",
          seasonNumber: 0,
          episodeNumber: 0,
          movieName: "The Dark Knight",
          file: "The.Dark.Knight.2008.mkv",
          releaseYear: "2008",
        })

        expect(result).toBe("The Dark Knight (2008).mkv")
      })

      it("should generate filename for movie without year", () => {
        const result = generateNewFileName("emby", {
          type: "movie",
          seasonNumber: 0,
          episodeNumber: 0,
          movieName: "Oppenheimer",
          file: "Oppenheimer.mkv",
          releaseYear: "",
        })

        expect(result).toBe("Oppenheimer.mkv")
      })
    })

    describe("tvshow", () => {
      it("should generate filename for tv show episode", () => {
        const result = generateNewFileName("emby", {
          type: "tv",
          seasonNumber: 3,
          episodeNumber: 7,
          episodeName: "Winter Is Coming",
          tvshowName: "Game of Thrones",
          file: "S03E07.mkv",
          releaseYear: "",
        })

        expect(result).toBe("Season 3/Game of Thrones S3E7 Winter Is Coming.mkv")
      })
    })
  })
})
