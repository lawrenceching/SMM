import { describe, it, expect } from 'bun:test'
import { generateFileNameByJavaScript, plex, emby } from './renameRules'

describe('generateFileNameByJavaScript', () => {

  describe('Plex rename rules', () => {

    describe('movie', () => {
      it('should generate filename for movie with year', () => {
        const context = {
          type: 'movie' as const,
          seasonNumber: 0,
          episodeNumber: 0,
          movieName: 'The Matrix',
          file: 'The.Matrix.1999.mkv',
          tmdbId: '603',
          releaseYear: '1999'
        }

        const result = generateFileNameByJavaScript(plex, context)

        expect(result).toBe('The Matrix (1999).mkv')
      })

      it('should generate filename for movie without year', () => {
        const context = {
          type: 'movie' as const,
          seasonNumber: 0,
          episodeNumber: 0,
          movieName: 'Inception',
          file: 'Inception.mkv',
          tmdbId: '27205',
          releaseYear: ''
        }

        const result = generateFileNameByJavaScript(plex, context)

        expect(result).toBe('Inception.mkv')
      })
    })

    describe('tvshow', () => {
      it('should generate filename for tv show episode', () => {
        const context = {
          type: 'tv' as const,
          seasonNumber: 1,
          episodeNumber: 5,
          episodeName: 'Enter the Matrix',
          tvshowName: 'The Matrix',
          file: 'S01E05.mkv',
          tmdbId: '603',
          releaseYear: ''
        }

        const result = generateFileNameByJavaScript(plex, context)

        expect(result).toBe('Season 01/The Matrix - S01E05 - Enter the Matrix.mkv')
      })

      it('should pad season and episode numbers with zeros', () => {
        const context = {
          type: 'tv' as const,
          seasonNumber: 2,
          episodeNumber: 10,
          episodeName: 'Test Episode',
          tvshowName: 'Test Show',
          file: 'S02E10.mkv',
          tmdbId: '123',
          releaseYear: ''
        }

        const result = generateFileNameByJavaScript(plex, context)

        expect(result).toBe('Season 02/Test Show - S02E10 - Test Episode.mkv')
      })
    })
  })

  describe('Emby rename rules', () => {

    describe('movie', () => {
      it('should generate filename for movie with year', () => {
        const context = {
          type: 'movie' as const,
          seasonNumber: 0,
          episodeNumber: 0,
          movieName: 'The Dark Knight',
          file: 'The.Dark.Knight.2008.mkv',
          tmdbId: '155',
          releaseYear: '2008'
        }

        const result = generateFileNameByJavaScript(emby, context)

        expect(result).toBe('The Dark Knight (2008).mkv')
      })

      it('should generate filename for movie without year', () => {
        const context = {
          type: 'movie' as const,
          seasonNumber: 0,
          episodeNumber: 0,
          movieName: 'Oppenheimer',
          file: 'Oppenheimer.mkv',
          tmdbId: '872585',
          releaseYear: ''
        }

        const result = generateFileNameByJavaScript(emby, context)

        expect(result).toBe('Oppenheimer.mkv')
      })
    })

    describe('tvshow', () => {
      it('should generate filename for tv show episode', () => {
        const context = {
          type: 'tv' as const,
          seasonNumber: 3,
          episodeNumber: 7,
          episodeName: 'Winter Is Coming',
          tvshowName: 'Game of Thrones',
          file: 'S03E07.mkv',
          tmdbId: '1399',
          releaseYear: ''
        }

        const result = generateFileNameByJavaScript(emby, context)

        expect(result).toBe('Season 3/Game of Thrones S3E7 Winter Is Coming.mkv')
      })
    })
  })

  describe('error handling', () => {
    it('should throw error with code context when code is invalid', () => {
      const invalidCode = 'const x = undefinedVariable; return x;'
      const context = {
        type: 'movie' as const,
        seasonNumber: 0,
        episodeNumber: 0,
        movieName: 'Test',
        file: 'test.mkv',
        tmdbId: '123',
        releaseYear: '2024'
      }

      expect(() => {
        generateFileNameByJavaScript(invalidCode, context)
      }).toThrow()
    })

    it('should return undefined when code does not return a value', () => {
      const noReturnCode = 'const x = 1;'
      const context = {
        type: 'movie' as const,
        seasonNumber: 0,
        episodeNumber: 0,
        movieName: 'Test',
        file: 'test.mkv',
        tmdbId: '123',
        releaseYear: '2024'
      }

      const result = generateFileNameByJavaScript(noReturnCode, context)

      expect(result).toBeUndefined()
    })
  })

  describe('extname usage', () => {
    it('should correctly extract extension from filename', () => {
      const codeWithVariousExtensions = `
const ext = extname(file);
if (type === "movie") {
  return movieName + ext;
} else {
  return tvshowName + ext;
}
`
      const context = {
        type: 'movie' as const,
        seasonNumber: 1,
        episodeNumber: 1,
        movieName: 'Test.Movie',
        tvshowName: 'Test.Show',
        file: 'Test.Movie.2024.mp4',
        tmdbId: '123',
        releaseYear: '2024'
      }

      const result = generateFileNameByJavaScript(codeWithVariousExtensions, context)

      expect(result).toBe('Test.Movie.mp4')
    })
  })
})
