import { describe, it, expect } from 'bun:test';
import { renameFileInMediaMetadata } from './mediaMetadataUtils';
import type { MediaMetadata } from '@core/types';

describe('renameFileInMediaMetadata', () => {
  it('should rename file in files array', () => {
    const mediaMetadata: MediaMetadata = {
      files: ['/path/to/old-file.mp4', '/path/to/other-file.mp4'],
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/old-file.mp4',
      '/path/to/new-file.mp4'
    );

    expect(result.files).toEqual(['/path/to/new-file.mp4', '/path/to/other-file.mp4']);
    // Ensure original is not mutated
    expect(mediaMetadata.files).toEqual(['/path/to/old-file.mp4', '/path/to/other-file.mp4']);
  });

  it('should rename file in mediaFiles array', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFiles: [
        {
          absolutePath: '/path/to/old-file.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
        {
          absolutePath: '/path/to/other-file.mp4',
          seasonNumber: 1,
          episodeNumber: 2,
        },
      ],
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/old-file.mp4',
      '/path/to/new-file.mp4'
    );

    expect(result.mediaFiles).toEqual([
      {
        absolutePath: '/path/to/new-file.mp4',
        seasonNumber: 1,
        episodeNumber: 1,
      },
      {
        absolutePath: '/path/to/other-file.mp4',
        seasonNumber: 1,
        episodeNumber: 2,
      },
    ]);
    // Ensure original is not mutated
    expect(mediaMetadata.mediaFiles?.[0]?.absolutePath).toBe('/path/to/old-file.mp4');
  });

  it('should rename file in both files and mediaFiles arrays', () => {
    const mediaMetadata: MediaMetadata = {
      files: ['/path/to/old-file.mp4', '/path/to/other-file.mp4'],
      mediaFiles: [
        {
          absolutePath: '/path/to/old-file.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/old-file.mp4',
      '/path/to/new-file.mp4'
    );

    expect(result.files).toEqual(['/path/to/new-file.mp4', '/path/to/other-file.mp4']);
    expect(result.mediaFiles?.[0]?.absolutePath).toBe('/path/to/new-file.mp4');
    // Ensure original is not mutated
    expect(mediaMetadata.files?.[0]).toBe('/path/to/old-file.mp4');
    expect(mediaMetadata.mediaFiles?.[0]?.absolutePath).toBe('/path/to/old-file.mp4');
  });

  it('should not modify files when file does not exist in files array', () => {
    const mediaMetadata: MediaMetadata = {
      files: ['/path/to/other-file.mp4'],
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/nonexistent-file.mp4',
      '/path/to/new-file.mp4'
    );

    expect(result.files).toEqual(['/path/to/other-file.mp4']);
  });

  it('should not modify mediaFiles when file does not exist in mediaFiles array', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFiles: [
        {
          absolutePath: '/path/to/other-file.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/nonexistent-file.mp4',
      '/path/to/new-file.mp4'
    );

    expect(result.mediaFiles?.[0]?.absolutePath).toBe('/path/to/other-file.mp4');
  });

  it('should handle undefined files array', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFiles: [
        {
          absolutePath: '/path/to/old-file.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/old-file.mp4',
      '/path/to/new-file.mp4'
    );

    expect(result.files).toBeUndefined();
    expect(result.mediaFiles?.[0]?.absolutePath).toBe('/path/to/new-file.mp4');
  });

  it('should handle undefined mediaFiles array', () => {
    const mediaMetadata: MediaMetadata = {
      files: ['/path/to/old-file.mp4'],
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/old-file.mp4',
      '/path/to/new-file.mp4'
    );

    expect(result.mediaFiles).toBeUndefined();
    expect(result.files).toEqual(['/path/to/new-file.mp4']);
  });

  it('should handle null files array', () => {
    const mediaMetadata: MediaMetadata = {
      files: null,
      mediaFiles: [
        {
          absolutePath: '/path/to/old-file.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/old-file.mp4',
      '/path/to/new-file.mp4'
    );

    // When files is null, optional chaining returns undefined
    expect(result.files).toBeUndefined();
    expect(result.mediaFiles?.[0]?.absolutePath).toBe('/path/to/new-file.mp4');
  });

  it('should preserve other mediaFiles properties when renaming', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFiles: [
        {
          absolutePath: '/path/to/old-file.mp4',
          seasonNumber: 2,
          episodeNumber: 5,
          episodeName: 'Test Episode',
          subtitleFilePaths: ['/path/to/subtitle.srt'],
          audioFilePaths: ['/path/to/audio.mp3'],
        },
      ],
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/old-file.mp4',
      '/path/to/new-file.mp4'
    );

    expect(result.mediaFiles?.[0]).toEqual({
      absolutePath: '/path/to/new-file.mp4',
      seasonNumber: 2,
      episodeNumber: 5,
      episodeName: 'Test Episode',
      subtitleFilePaths: ['/path/to/subtitle.srt'],
      audioFilePaths: ['/path/to/audio.mp3'],
    });
  });

  it('should preserve all other MediaMetadata properties', () => {
    const mediaMetadata: MediaMetadata = {
      mediaName: 'Test Show',
      mediaFolderPath: '/path/to/media',
      files: ['/path/to/old-file.mp4'],
      mediaFiles: [
        {
          absolutePath: '/path/to/old-file.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
      type: 'tvshow-folder',
      tmdbMediaType: 'tv',
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/old-file.mp4',
      '/path/to/new-file.mp4'
    );

    expect(result.mediaName).toBe('Test Show');
    expect(result.mediaFolderPath).toBe('/path/to/media');
    expect(result.type).toBe('tvshow-folder');
    expect(result.tmdbMediaType).toBe('tv');
    expect(result.files).toEqual(['/path/to/new-file.mp4']);
  });

  it('should return a deep clone that does not mutate the original object', () => {
    const mediaMetadata: MediaMetadata = {
      files: ['/path/to/old-file.mp4'],
      mediaFiles: [
        {
          absolutePath: '/path/to/old-file.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };

    const result = renameFileInMediaMetadata(
      mediaMetadata,
      '/path/to/old-file.mp4',
      '/path/to/new-file.mp4'
    );

    // Modify the result
    if (result.files) {
      result.files.push('/path/to/another-file.mp4');
    }
    if (result.mediaFiles) {
      result.mediaFiles[0].seasonNumber = 999;
    }

    // Original should be unchanged
    expect(mediaMetadata.files).toEqual(['/path/to/old-file.mp4']);
    expect(mediaMetadata.mediaFiles?.[0]?.seasonNumber).toBe(1);
  });
});
