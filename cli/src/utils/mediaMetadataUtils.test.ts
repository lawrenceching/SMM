import { describe, it, expect } from 'bun:test';
import { renameFileInMediaMetadata, renameMediaFolderInMediaMetadata } from './mediaMetadataUtils';
import type { MediaMetadata } from '@core/types';

// Log to verify we're getting the real module, not a mock
console.log('[mediaMetadataUtils.test.ts] Imported renameMediaFolderInMediaMetadata:', typeof renameMediaFolderInMediaMetadata);
console.log('[mediaMetadataUtils.test.ts] Function name:', renameMediaFolderInMediaMetadata.name);

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

    // When files is null, it should remain null
    expect(result.files).toBeNull();
    expect(result.mediaFiles?.[0]?.absolutePath).toBe('/path/to/new-file.mp4');
  });

  it('should preserve other mediaFiles properties when renaming', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFiles: [
        {
          absolutePath: '/path/to/old-file.mp4',
          seasonNumber: 2,
          episodeNumber: 5,
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
    if (result.mediaFiles && result.mediaFiles[0]) {
      result.mediaFiles[0].seasonNumber = 999;
    }

    // Original should be unchanged
    expect(mediaMetadata.files).toEqual(['/path/to/old-file.mp4']);
    expect(mediaMetadata.mediaFiles?.[0]?.seasonNumber).toBe(1);
  });
});

describe('renameMediaFolderInMediaMetadata', () => {
  it('should rename folder in files array', () => {
    // Log to verify we're getting the real function, not a mock
    console.log('[mediaMetadataUtils.test.ts] renameMediaFolderInMediaMetadata function:', renameMediaFolderInMediaMetadata.toString().substring(0, 150));
    console.log('[mediaMetadataUtils.test.ts] Is this the real function?', !renameMediaFolderInMediaMetadata.toString().includes('mockRenameMediaFolderInMediaMetadataReturn'));
    
    const mediaMetadata: MediaMetadata = {
      files: [
        '/path/to/old-folder/file1.mp4',
        '/path/to/old-folder/file2.mp4',
        '/path/to/other-folder/file3.mp4',
      ],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    console.log('[mediaMetadataUtils.test.ts] Result files:', result.files);
    console.log('[mediaMetadataUtils.test.ts] Expected files:', [
      '/path/to/new-folder/file1.mp4',
      '/path/to/new-folder/file2.mp4',
      '/path/to/other-folder/file3.mp4',
    ]);

    expect(result.files).toEqual([
      '/path/to/new-folder/file1.mp4',
      '/path/to/new-folder/file2.mp4',
      '/path/to/other-folder/file3.mp4',
    ]);
    // Ensure original is not mutated
    expect(mediaMetadata.files).toEqual([
      '/path/to/old-folder/file1.mp4',
      '/path/to/old-folder/file2.mp4',
      '/path/to/other-folder/file3.mp4',
    ]);
  });

  it('should rename folder in mediaFiles absolutePath', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFiles: [
        {
          absolutePath: '/path/to/old-folder/file1.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
        {
          absolutePath: '/path/to/old-folder/file2.mp4',
          seasonNumber: 1,
          episodeNumber: 2,
        },
        {
          absolutePath: '/path/to/other-folder/file3.mp4',
          seasonNumber: 2,
          episodeNumber: 1,
        },
      ],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    expect(result.mediaFiles).toEqual([
      {
        absolutePath: '/path/to/new-folder/file1.mp4',
        seasonNumber: 1,
        episodeNumber: 1,
      },
      {
        absolutePath: '/path/to/new-folder/file2.mp4',
        seasonNumber: 1,
        episodeNumber: 2,
      },
      {
        absolutePath: '/path/to/other-folder/file3.mp4',
        seasonNumber: 2,
        episodeNumber: 1,
      },
    ]);
    // Ensure original is not mutated
    expect(mediaMetadata.mediaFiles?.[0]?.absolutePath).toBe('/path/to/old-folder/file1.mp4');
  });

  it('should update mediaFolderPath when it matches', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/path/to/old-folder',
      files: ['/path/to/old-folder/file1.mp4'],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    expect(result.mediaFolderPath).toBe('/path/to/new-folder');
    expect(result.files).toEqual(['/path/to/new-folder/file1.mp4']);
  });

  it('should not update mediaFolderPath when it does not match', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/path/to/other-folder',
      files: ['/path/to/old-folder/file1.mp4'],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    expect(result.mediaFolderPath).toBe('/path/to/other-folder');
    expect(result.files).toEqual(['/path/to/new-folder/file1.mp4']);
  });

  it('should handle nested paths within the folder', () => {
    const mediaMetadata: MediaMetadata = {
      files: [
        '/path/to/old-folder/season1/episode1.mp4',
        '/path/to/old-folder/season1/episode2.mp4',
        '/path/to/old-folder/season2/episode1.mp4',
      ],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    expect(result.files).toEqual([
      '/path/to/new-folder/season1/episode1.mp4',
      '/path/to/new-folder/season1/episode2.mp4',
      '/path/to/new-folder/season2/episode1.mp4',
    ]);
  });

  it('should handle undefined files array', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFiles: [
        {
          absolutePath: '/path/to/old-folder/file1.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    expect(result.files).toBeUndefined();
    expect(result.mediaFiles?.[0]?.absolutePath).toBe('/path/to/new-folder/file1.mp4');
  });

  it('should handle undefined mediaFiles array', () => {
    const mediaMetadata: MediaMetadata = {
      files: ['/path/to/old-folder/file1.mp4'],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    expect(result.mediaFiles).toBeUndefined();
    expect(result.files).toEqual(['/path/to/new-folder/file1.mp4']);
  });

  it('should handle null files array', () => {
    const mediaMetadata: MediaMetadata = {
      files: null,
      mediaFiles: [
        {
          absolutePath: '/path/to/old-folder/file1.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    // When files is null, it should remain null
    expect(result.files).toBeNull();
    expect(result.mediaFiles?.[0]?.absolutePath).toBe('/path/to/new-folder/file1.mp4');
  });

  it('should not modify paths that do not start with the folder path', () => {
    const mediaMetadata: MediaMetadata = {
      files: [
        '/path/to/old-folder/file1.mp4',
        '/path/to/old-folder-name/file2.mp4', // Similar prefix but not matching
        '/path/to/other-folder/file3.mp4',
      ],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    expect(result.files).toEqual([
      '/path/to/new-folder/file1.mp4',
      '/path/to/old-folder-name/file2.mp4', // Should remain unchanged
      '/path/to/other-folder/file3.mp4',
    ]);
  });

  it('should preserve other mediaFiles properties when renaming', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFiles: [
        {
          absolutePath: '/path/to/old-folder/file1.mp4',
          seasonNumber: 2,
          episodeNumber: 5,
        },
      ],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    expect(result.mediaFiles?.[0]).toEqual({
      absolutePath: '/path/to/new-folder/file1.mp4',
      seasonNumber: 2,
      episodeNumber: 5,
    });
  });

  it('should preserve all other MediaMetadata properties', () => {
    const mediaMetadata: MediaMetadata = {
      mediaName: 'Test Show',
      mediaFolderPath: '/path/to/old-folder',
      files: ['/path/to/old-folder/file1.mp4'],
      mediaFiles: [
        {
          absolutePath: '/path/to/old-folder/file1.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
      type: 'tvshow-folder',
      tmdbMediaType: 'tv',
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    expect(result.mediaName).toBe('Test Show');
    expect(result.mediaFolderPath).toBe('/path/to/new-folder');
    expect(result.type).toBe('tvshow-folder');
    expect(result.tmdbMediaType).toBe('tv');
    expect(result.files).toEqual(['/path/to/new-folder/file1.mp4']);
    expect(result.mediaFiles?.[0]?.absolutePath).toBe('/path/to/new-folder/file1.mp4');
  });

  it('should return a deep clone that does not mutate the original object', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/path/to/old-folder',
      files: ['/path/to/old-folder/file1.mp4'],
      mediaFiles: [
        {
          absolutePath: '/path/to/old-folder/file1.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    // Modify the result
    if (result.files) {
      result.files.push('/path/to/new-folder/another-file.mp4');
    }
    if (result.mediaFiles && result.mediaFiles[0]) {
      result.mediaFiles[0].seasonNumber = 999;
    }

    // Original should be unchanged
    expect(mediaMetadata.mediaFolderPath).toBe('/path/to/old-folder');
    expect(mediaMetadata.files).toEqual(['/path/to/old-folder/file1.mp4']);
    expect(mediaMetadata.mediaFiles?.[0]?.seasonNumber).toBe(1);
    expect(mediaMetadata.mediaFiles?.[0]?.absolutePath).toBe('/path/to/old-folder/file1.mp4');
  });

  it('should handle exact folder path match', () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath: '/path/to/old-folder',
      files: ['/path/to/old-folder'],
    };

    const result = renameMediaFolderInMediaMetadata(
      mediaMetadata,
      '/path/to/old-folder',
      '/path/to/new-folder'
    );

    expect(result.mediaFolderPath).toBe('/path/to/new-folder');
    expect(result.files).toEqual(['/path/to/new-folder']);
  });


});
