import { describe, it, expect } from 'vitest';
import { createMediaMetadata } from './mediaMetadata';

describe('createMediaMetadata', () => {
  describe('basic functionality', () => {
    it('should create media metadata with music-folder type', () => {
      const result = createMediaMetadata('/media/music', 'music-folder');

      expect(result).toEqual({
        mediaFolderPath: '/media/music',
        type: 'music-folder',
      });
    });

    it('should create media metadata with tvshow-folder type', () => {
      const result = createMediaMetadata('/media/tvshows/ShowName', 'tvshow-folder');

      expect(result).toEqual({
        mediaFolderPath: '/media/tvshows/ShowName',
        type: 'tvshow-folder',
      });
    });

    it('should create media metadata with movie-folder type', () => {
      const result = createMediaMetadata('/media/movies', 'movie-folder');

      expect(result).toEqual({
        mediaFolderPath: '/media/movies',
        type: 'movie-folder',
      });
    });
  });

  describe('path conversion', () => {
    it('should convert Windows local path to POSIX format', () => {
      const result = createMediaMetadata('C:\\media\\movies', 'movie-folder');

      expect(result.mediaFolderPath).toBe('/C/media/movies');
    });

    it('should convert Windows network path to POSIX format', () => {
      const result = createMediaMetadata('\\\\server\\share\\media', 'tvshow-folder');

      expect(result.mediaFolderPath).toBe('/server/share/media');
    });

    it('should keep POSIX path as-is', () => {
      const result = createMediaMetadata('/media/music', 'music-folder');

      expect(result.mediaFolderPath).toBe('/media/music');
    });

    it('should handle path with spaces', () => {
      const result = createMediaMetadata('/media/TV Shows/Show Name', 'tvshow-folder');

      expect(result.mediaFolderPath).toBe('/media/TV Shows/Show Name');
    });

    it('should handle Windows path with spaces', () => {
      const result = createMediaMetadata('C:\\Media\\TV Shows\\Show Name', 'tvshow-folder');

      expect(result.mediaFolderPath).toBe('/C/Media/TV Shows/Show Name');
    });

    it('should handle UNC path with spaces', () => {
      const result = createMediaMetadata('\\\\server\\share\\Media\\TV Shows\\Show Name', 'tvshow-folder');

      expect(result.mediaFolderPath).toBe('/server/share/Media/TV Shows/Show Name');
    });
  });

  describe('additional properties', () => {
    it('should merge additional properties', () => {
      const result = createMediaMetadata('/media/movies', 'movie-folder', {
        tmdbTVShowId: 12345,
        mediaName: 'Test Movie',
      });

      expect(result).toEqual({
        mediaFolderPath: '/media/movies',
        type: 'movie-folder',
        tmdbTVShowId: 12345,
        mediaName: 'Test Movie',
      });
    });

    it('should merge complex nested properties', () => {
      const tmdbTvShow = {
        id: 12345,
        name: 'Test Show',
        overview: 'A test show',
        poster_path: '/poster.jpg',
        backdrop_path: null,
        first_air_date: '2024-01-01',
        vote_average: 8.5,
        vote_count: 100,
        popularity: 50.5,
        genre_ids: [1, 2],
        origin_country: ['US'],
      };

      const result = createMediaMetadata('/media/tvshows/Test Show', 'tvshow-folder', {
        tmdbTVShowId: 12345,
        tmdbTvShow: tmdbTvShow as any,
      });

      expect(result).toEqual({
        mediaFolderPath: '/media/tvshows/Test Show',
        type: 'tvshow-folder',
        tmdbTVShowId: 12345,
        tmdbTvShow,
      });
    });

    it('should override mediaFolderPath with provided value', () => {
      const result = createMediaMetadata('/media/tvshows/Original', 'tvshow-folder', {
        mediaFolderPath: '/media/tvshows/Overridden',
      });

      expect(result.mediaFolderPath).toBe('/media/tvshows/Overridden');
    });

    it('should override type with provided value', () => {
      const result = createMediaMetadata('/media/tvshows/Show', 'tvshow-folder', {
        type: 'movie-folder',
      });

      expect(result.type).toBe('movie-folder');
    });

    it('should merge files property', () => {
      const files = ['/media/tvshows/Show/episode1.mkv', '/media/tvshows/Show/episode2.mkv'];
      const result = createMediaMetadata('/media/tvshows/Show', 'tvshow-folder', {
        files,
      });

      expect(result.files).toEqual(files);
    });

    it('should merge mediaFiles property', () => {
      const mediaFiles = [
        {
          absolutePath: '/media/tvshows/Show/episode1.mkv',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ];
      const result = createMediaMetadata('/media/tvshows/Show', 'tvshow-folder', {
        mediaFiles,
      });

      expect(result.mediaFiles).toEqual(mediaFiles);
    });

    it('should merge tmdbMovie property', () => {
      const tmdbMovie = {
        id: 12345,
        title: 'Test Movie',
        original_title: 'Test Movie',
        overview: 'A test movie',
        poster_path: '/poster.jpg',
        backdrop_path: null,
        release_date: '2024-01-01',
        vote_average: 8.5,
        vote_count: 100,
        popularity: 50.5,
        genre_ids: [1, 2],
        adult: false,
        video: false,
      };
      const result = createMediaMetadata('/media/movies/Test Movie', 'movie-folder', {
        tmdbMovie,
      });

      expect(result.tmdbMovie).toEqual(tmdbMovie);
    });
  });

  describe('empty and undefined props', () => {
    it('should handle empty props object', () => {
      const result = createMediaMetadata('/media/music', 'music-folder', {});

      expect(result).toEqual({
        mediaFolderPath: '/media/music',
        type: 'music-folder',
      });
    });

    it('should handle undefined props (default parameter)', () => {
      const result = createMediaMetadata('/media/music', 'music-folder');

      expect(result).toEqual({
        mediaFolderPath: '/media/music',
        type: 'music-folder',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle single character path', () => {
      const result = createMediaMetadata('/a', 'movie-folder');

      expect(result.mediaFolderPath).toBe('/a');
    });

    it('should handle deeply nested path', () => {
      const result = createMediaMetadata('/media/very/deeply/nested/folder/path', 'tvshow-folder');

      expect(result.mediaFolderPath).toBe('/media/very/deeply/nested/folder/path');
    });

    it('should handle path with special characters', () => {
      const result = createMediaMetadata('/media/Show-S01E01_[1080p]', 'tvshow-folder');

      expect(result.mediaFolderPath).toBe('/media/Show-S01E01_[1080p]');
    });

    it('should handle Windows path with special characters', () => {
      const result = createMediaMetadata('C:\\Media\\Show-S01E01_[1080p]', 'tvshow-folder');

      expect(result.mediaFolderPath).toBe('/C/Media/Show-S01E01_[1080p]');
    });

    it('should remove trailing separator from path', () => {
      const result = createMediaMetadata('/media/music/', 'music-folder');

      expect(result.mediaFolderPath).toBe('/media/music');
    });

    it('should remove trailing separator from Windows path', () => {
      const result = createMediaMetadata('C:\\media\\music\\', 'music-folder');

      expect(result.mediaFolderPath).toBe('/C/media/music');
    });
  });

  describe('return value', () => {
    it('should return new object each time', () => {
      const result1 = createMediaMetadata('/media/music', 'music-folder');
      const result2 = createMediaMetadata('/media/music', 'music-folder');

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });

    it('should create independent objects when props differ', () => {
      const result1 = createMediaMetadata('/media/music', 'music-folder', {
        mediaName: 'Album 1',
      });
      const result2 = createMediaMetadata('/media/music', 'music-folder', {
        mediaName: 'Album 2',
      });

      expect(result1.mediaName).toBe('Album 1');
      expect(result2.mediaName).toBe('Album 2');
    });
  });
});
