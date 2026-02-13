import { describe, it, expect } from 'bun:test';
import { renameFolderInMediaMetadata } from './mediaMetadata';
import type { MediaMetadata } from './types';

describe('renameFolderInMediaMetadata', () => {
  describe('mediaMetadata.mediaFolderPath', () => {
    it('should rename mediaFolderPath', () => {
      const metadata: MediaMetadata = {
        mediaFolderPath: '/media/tvshow',
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/tvshow-renamed');

      expect(result.mediaFolderPath).toBe('/media/tvshow-renamed');
    });

    it('should handle mediaFolderPath with trailing slash', () => {
      const metadata: MediaMetadata = {
        mediaFolderPath: '/media/tvshow/',
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow/', '/media/tvshow-renamed/');

      expect(result.mediaFolderPath).toBe('/media/tvshow-renamed/');
    });

    it('should not rename mediaFolderPath if it does not start with from path', () => {
      const metadata: MediaMetadata = {
        mediaFolderPath: '/other/path',
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.mediaFolderPath).toBe('/other/path');
    });

    it('should not rename mediaFolderPath when it is null', () => {
      const metadata: MediaMetadata = {
        mediaFolderPath: null,
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.mediaFolderPath).toBeNull();
    });

    it('should not rename mediaFolderPath when it is undefined', () => {
      const metadata: MediaMetadata = {};

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.mediaFolderPath).toBeUndefined();
    });
  });

  describe('mediaMetadata.files', () => {
    it('should rename folder in files array', () => {
      const metadata: MediaMetadata = {
        files: [
          '/media/tvshow/Season 01/episode01.mkv',
          '/media/tvshow/Season 01/episode02.mkv',
          '/media/tvshow/poster.jpg',
        ],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/tvshow-renamed');

      expect(result.files).toEqual([
        '/media/tvshow-renamed/Season 01/episode01.mkv',
        '/media/tvshow-renamed/Season 01/episode02.mkv',
        '/media/tvshow-renamed/poster.jpg',
      ]);
    });

    it('should handle paths with trailing slash', () => {
      const metadata: MediaMetadata = {
        files: [
          '/media/tvshow/Season 01/episode01.mkv',
        ],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow/', '/media/tvshow-renamed/');

      expect(result.files).toEqual([
        '/media/tvshow-renamed/Season 01/episode01.mkv',
      ]);
    });

    it('should only rename files that start with the from path', () => {
      const metadata: MediaMetadata = {
        files: [
          '/media/tvshow/Season 01/episode01.mkv',
          '/media/other/show/episode02.mkv',
          '/media/tvshow-renamed/episode03.mkv',
        ],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.files).toEqual([
        '/media/newname/Season 01/episode01.mkv',
        '/media/other/show/episode02.mkv',
        '/media/tvshow-renamed/episode03.mkv',
      ]);
    });

    it('should not match partial folder names', () => {
      const metadata: MediaMetadata = {
        files: [
          '/media/tvshow/Season 01/episode01.mkv',
          '/media/tvshow2/Season 01/episode02.mkv',
        ],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.files).toEqual([
        '/media/newname/Season 01/episode01.mkv',
        '/media/tvshow2/Season 01/episode02.mkv',
      ]);
    });

    it('should handle empty files array', () => {
      const metadata: MediaMetadata = {
        files: [],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.files).toEqual([]);
    });

    it('should handle null files', () => {
      const metadata: MediaMetadata = {
        files: null,
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.files).toBeNull();
    });

    it('should handle undefined files', () => {
      const metadata: MediaMetadata = {};

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.files).toBeUndefined();
    });
  });

  describe('mediaMetadata.mediaFiles', () => {
    it('should rename folder in mediaFiles absolutePath', () => {
      const metadata: MediaMetadata = {
        mediaFiles: [
          {
            absolutePath: '/media/tvshow/Season 01/episode01.mkv',
            seasonNumber: 1,
            episodeNumber: 1,
          },
          {
            absolutePath: '/media/tvshow/Season 01/episode02.mkv',
            seasonNumber: 1,
            episodeNumber: 2,
          },
        ],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/tvshow-renamed');

      expect(result.mediaFiles).toEqual([
        {
          absolutePath: '/media/tvshow-renamed/Season 01/episode01.mkv',
          seasonNumber: 1,
          episodeNumber: 1,
        },
        {
          absolutePath: '/media/tvshow-renamed/Season 01/episode02.mkv',
          seasonNumber: 1,
          episodeNumber: 2,
        },
      ]);
    });

    it('should preserve other properties in mediaFiles', () => {
      const metadata: MediaMetadata = {
        mediaFiles: [
          {
            absolutePath: '/media/tvshow/Season 01/episode01.mkv',
            seasonNumber: 1,
            episodeNumber: 1,
          },
        ],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/new');

      expect(result.mediaFiles?.[0]?.seasonNumber).toBe(1);
      expect(result.mediaFiles?.[0]?.episodeNumber).toBe(1);
    });

    it('should only rename mediaFiles that start with the from path', () => {
      const metadata: MediaMetadata = {
        mediaFiles: [
          {
            absolutePath: '/media/tvshow/Season 01/episode01.mkv',
            seasonNumber: 1,
            episodeNumber: 1,
          },
          {
            absolutePath: '/media/other/show/episode02.mkv',
            seasonNumber: 1,
            episodeNumber: 2,
          },
        ],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.mediaFiles?.[0]?.absolutePath).toBe('/media/newname/Season 01/episode01.mkv');
      expect(result.mediaFiles?.[1]?.absolutePath).toBe('/media/other/show/episode02.mkv');
    });

    it('should handle empty mediaFiles array', () => {
      const metadata: MediaMetadata = {
        mediaFiles: [],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.mediaFiles).toEqual([]);
    });

    it('should handle undefined mediaFiles', () => {
      const metadata: MediaMetadata = {};

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.mediaFiles).toBeUndefined();
    });
  });

  describe('both files, mediaFiles, and mediaFolderPath', () => {
    it('should rename folder in files, mediaFiles, and mediaFolderPath', () => {
      const metadata: MediaMetadata = {
        mediaFolderPath: '/media/tvshow',
        files: [
          '/media/tvshow/Season 01/episode01.mkv',
          '/media/tvshow/poster.jpg',
        ],
        mediaFiles: [
          {
            absolutePath: '/media/tvshow/Season 01/episode01.mkv',
            seasonNumber: 1,
            episodeNumber: 1,
          },
        ],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.mediaFolderPath).toBe('/media/newname');
      expect(result.files).toEqual([
        '/media/newname/Season 01/episode01.mkv',
        '/media/newname/poster.jpg',
      ]);
      expect(result.mediaFiles?.[0]?.absolutePath).toBe('/media/newname/Season 01/episode01.mkv');
    });
  });

  describe('immutability', () => {
    it('should not modify the original metadata object', () => {
      const metadata: MediaMetadata = {
        mediaFolderPath: '/media/tvshow',
        files: ['/media/tvshow/episode01.mkv'],
        mediaFiles: [
          {
            absolutePath: '/media/tvshow/episode01.mkv',
            seasonNumber: 1,
            episodeNumber: 1,
          },
        ],
      };

      const originalMediaFolderPath = metadata.mediaFolderPath;
      const originalFiles = [...metadata.files!];
      const originalMediaFiles = [...metadata.mediaFiles!];

      renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(metadata.mediaFolderPath).toBe(originalMediaFolderPath);
      expect(metadata.files).toEqual(originalFiles);
      expect(metadata.mediaFiles).toEqual(originalMediaFiles);
    });

    it('should return a new object', () => {
      const metadata: MediaMetadata = {
        files: ['/media/tvshow/episode01.mkv'],
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result).not.toBe(metadata);
    });
  });

  describe('other properties', () => {
    it('should preserve other properties in MediaMetadata', () => {
      const metadata: MediaMetadata = {
        files: ['/media/tvshow/episode01.mkv'],
        mediaFolderPath: '/media/tvshow',
        tmdbTVShowId: 12345,
        tmdbTvShow: {
          id: 12345,
          name: 'Test TV Show',
          original_name: 'Test TV Show',
          overview: 'Test overview',
          poster_path: '/poster.jpg',
          backdrop_path: '/backdrop.jpg',
          first_air_date: '2020-01-01',
          vote_average: 8.5,
          vote_count: 100,
          popularity: 10.5,
          genre_ids: [1, 2],
          origin_country: ['US'],
          number_of_seasons: 1,
          number_of_episodes: 10,
          seasons: [],
          status: 'Ended',
          type: 'Scripted',
          in_production: false,
          last_air_date: '2020-03-01',
          networks: [],
          production_companies: [],
        },
      };

      const result = renameFolderInMediaMetadata(metadata, '/media/tvshow', '/media/newname');

      expect(result.mediaFolderPath).toBe('/media/newname');
      expect(result.tmdbTVShowId).toBe(12345);
      expect(result.tmdbTvShow?.id).toBe(12345);
      expect(result.tmdbTvShow?.name).toBe('Test TV Show');
    });
  });
});
