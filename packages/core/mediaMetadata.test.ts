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
        movie: {
          id: '12345',
          name: 'Test Movie',
          database: 'TMDB',
        },
      });

      expect(result).toEqual({
        mediaFolderPath: '/media/movies',
        type: 'movie-folder',
        movie: {
          id: '12345',
          name: 'Test Movie',
          database: 'TMDB',
        },
      });
    });

    it('should merge complex nested properties', () => {
      const tvShow = {
        id: '12345',
        name: 'Test Show',
        database: 'TMDB' as const,
        seasons: [],
      };

      const result = createMediaMetadata('/media/tvshows/Test Show', 'tvshow-folder', {
        tvShow,
      });

      expect(result).toEqual({
        mediaFolderPath: '/media/tvshows/Test Show',
        type: 'tvshow-folder',
        tvShow,
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

    it('should merge movie property', () => {
      const movie = {
        id: '12345',
        name: 'Test Movie',
        database: 'TMDB' as const,
        airDate: '2024-01-01',
      };
      const result = createMediaMetadata('/media/movies/Test Movie', 'movie-folder', {
        movie,
      });

      expect(result.movie).toEqual(movie);
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
        files: ['/a/1.mp3'],
      });
      const result2 = createMediaMetadata('/media/music', 'music-folder', {
        files: ['/a/2.mp3'],
      });

      expect(result1.files).toEqual(['/a/1.mp3']);
      expect(result2.files).toEqual(['/a/2.mp3']);
    });
  });
});
