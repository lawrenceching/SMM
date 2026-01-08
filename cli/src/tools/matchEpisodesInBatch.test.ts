import { describe, it, expect } from 'bun:test';
import { updateMediaFileMetadatas, validateFileExists, validateAllFiles } from './matchEpisodesInBatch';
import type { MediaFileMetadata, MediaMetadata } from '@core/types';

describe('updateMediaFileMetadatas', () => {
  it('should add a new entry when file does not exist in array', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/path/to/file1.mp4',
        seasonNumber: 1,
        episodeNumber: 1,
      },
    ];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file2.mp4',
      2,
      3
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      absolutePath: '/path/to/file1.mp4',
      seasonNumber: 1,
      episodeNumber: 1,
    });
    expect(result[1]).toEqual({
      absolutePath: '/path/to/file2.mp4',
      seasonNumber: 2,
      episodeNumber: 3,
    });
    // Ensure original is not mutated
    expect(mediaFiles).toHaveLength(1);
  });

  it('should update existing entry when file already exists in array', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/path/to/file1.mp4',
        seasonNumber: 1,
        episodeNumber: 1,
      },
      {
        absolutePath: '/path/to/file2.mp4',
        seasonNumber: 2,
        episodeNumber: 2,
      },
    ];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file1.mp4',
      3,
      4
    );

    expect(result).toHaveLength(2);
    // The function removes file1 (by path), then adds it back at the end
    // So file2 comes first, then file1 with updated season/episode
    expect(result[0]).toEqual({
      absolutePath: '/path/to/file2.mp4',
      seasonNumber: 2,
      episodeNumber: 2,
    });
    expect(result[1]).toEqual({
      absolutePath: '/path/to/file1.mp4',
      seasonNumber: 3,
      episodeNumber: 4,
    });
    // Ensure original is not mutated
    expect(mediaFiles[0]?.seasonNumber).toBe(1);
    expect(mediaFiles[0]?.episodeNumber).toBe(1);
  });

  it('should update existing entry when the media file for given season and episode exists in array', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/path/to/file1.mp4',
        seasonNumber: 2,
        episodeNumber: 5,
        subtitleFilePaths: ['/path/to/subtitle.srt'],
      },
      {
        absolutePath: '/path/to/file2.mp4',
        seasonNumber: 1,
        episodeNumber: 1,
      },
    ];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file1.mp4',
      2,
      5
    );

    expect(result).toHaveLength(2);
    // The function removes file1 (by season/episode match, then by path), then adds it back at the end
    // Note: Other properties like subtitleFilePaths are NOT preserved - only absolutePath, seasonNumber, episodeNumber
    expect(result[0]).toEqual({
      absolutePath: '/path/to/file2.mp4',
      seasonNumber: 1,
      episodeNumber: 1,
    });
    expect(result[1]).toEqual({
      absolutePath: '/path/to/file1.mp4',
      seasonNumber: 2,
      episodeNumber: 5,
      // subtitleFilePaths is NOT preserved - function creates a new object with only the three fields
    });
    // Ensure original is not mutated
    expect(mediaFiles[0]?.seasonNumber).toBe(2);
    expect(mediaFiles[0]?.episodeNumber).toBe(5);
    expect(mediaFiles[0]?.subtitleFilePaths).toEqual(['/path/to/subtitle.srt']);
    // Verify immutability - result[1] should be a different object reference from the original file1
    expect(result[1]).not.toBe(mediaFiles[0]);
  });

  /**
   * This test case covers the abnormal case that there are multiple media files for same season and episode.
   * The media metadata maybe generated in previous version of SMM which does not handle media metadata properly.
   * The updateMediaFileMetadatas should be robust enough to handle this case.
   */
  it('should update existing entry when the multiple media files for given season and episode exists in array', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/path/to/file1.mp4',
        seasonNumber: 2,
        episodeNumber: 5,
      },
      {
        absolutePath: '/path/to/file3.mp4',
        seasonNumber: 2,
        episodeNumber: 5,
      },
      {
        absolutePath: '/path/to/file2.mp4',
        seasonNumber: 1,
        episodeNumber: 1,
      },
    ];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file1.mp4',
      2,
      5
    );

    expect(result).toHaveLength(2);
    // The function removes all files with the same season/episode, then removes files with the same path,
    // and finally adds the new entry at the end. So file2.mp4 (S1E1) comes first, then file1.mp4 (S2E5)
    expect(result[0]).toEqual({
      absolutePath: '/path/to/file2.mp4',
      seasonNumber: 1,
      episodeNumber: 1,
    });
    expect(result[1]).toEqual({
      absolutePath: '/path/to/file1.mp4',
      seasonNumber: 2,
      episodeNumber: 5,
    });
    // Ensure original is not mutated
    expect(mediaFiles[0]?.seasonNumber).toBe(2);
    expect(mediaFiles[0]?.episodeNumber).toBe(5);
    // Verify immutability - result[1] should be a different object reference from the original file1
    expect(result[1]).not.toBe(mediaFiles[0]);
  });  

  it('should handle empty array by adding new entry', () => {
    const mediaFiles: MediaFileMetadata[] = [];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file1.mp4',
      1,
      1
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      absolutePath: '/path/to/file1.mp4',
      seasonNumber: 1,
      episodeNumber: 1,
    });
    // Ensure original is not mutated
    expect(mediaFiles).toHaveLength(0);
  });

  it('should return a new array that does not mutate the original array structure', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/path/to/file1.mp4',
        seasonNumber: 1,
        episodeNumber: 1,
      },
    ];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file2.mp4',
      2,
      2
    );

    // Modify the result array structure
    result.push({
      absolutePath: '/path/to/file3.mp4',
      seasonNumber: 3,
      episodeNumber: 3,
    });

    // Original array should be unchanged
    expect(mediaFiles).toHaveLength(1);
  });

  it('should return a new object for updated entry that does not mutate the original', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/path/to/file1.mp4',
        seasonNumber: 1,
        episodeNumber: 1,
      },
    ];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file1.mp4',
      2,
      2
    );

    // Modify the updated entry in result
    if (result[0]) {
      result[0].seasonNumber = 999;
    }

    // Original entry should be unchanged (new object was created for update)
    expect(mediaFiles[0]?.seasonNumber).toBe(1);
    expect(mediaFiles[0]?.episodeNumber).toBe(1);
  });


  it('should handle files with undefined seasonNumber and episodeNumber', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/path/to/file1.mp4',
        // seasonNumber and episodeNumber are undefined
      },
    ];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file1.mp4',
      1,
      1
    );

    expect(result[0]).toEqual({
      absolutePath: '/path/to/file1.mp4',
      seasonNumber: 1,
      episodeNumber: 1,
    });
  });

  it('should handle adding file when existing entry has undefined season/episode', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/path/to/file1.mp4',
        // seasonNumber and episodeNumber are undefined
      },
    ];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file2.mp4',
      2,
      3
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.absolutePath).toBe('/path/to/file1.mp4');
    expect(result[1]).toEqual({
      absolutePath: '/path/to/file2.mp4',
      seasonNumber: 2,
      episodeNumber: 3,
    });
  });

  it('should handle path matching exactly (case-sensitive)', () => {
    const mediaFiles: MediaFileMetadata[] = [
      {
        absolutePath: '/path/to/file1.mp4',
        seasonNumber: 1,
        episodeNumber: 1,
      },
    ];

    // Different case should be treated as different file
    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/Path/To/File1.mp4',
      2,
      2
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.absolutePath).toBe('/path/to/file1.mp4');
    expect(result[1]).toEqual({
      absolutePath: '/Path/To/File1.mp4',
      seasonNumber: 2,
      episodeNumber: 2,
    });
  });

  it('should handle multiple updates to same file sequentially', () => {
    let mediaFiles: MediaFileMetadata[] = [];

    mediaFiles = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file1.mp4',
      1,
      1
    );
    expect(mediaFiles).toHaveLength(1);
    expect(mediaFiles[0]?.seasonNumber).toBe(1);
    expect(mediaFiles[0]?.episodeNumber).toBe(1);

    mediaFiles = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file1.mp4',
      2,
      2
    );
    expect(mediaFiles).toHaveLength(1);
    expect(mediaFiles[0]?.seasonNumber).toBe(2);
    expect(mediaFiles[0]?.episodeNumber).toBe(2);

    mediaFiles = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file1.mp4',
      3,
      3
    );
    expect(mediaFiles).toHaveLength(1);
    expect(mediaFiles[0]?.seasonNumber).toBe(3);
    expect(mediaFiles[0]?.episodeNumber).toBe(3);
  });

  it('should handle season 0 (specials)', () => {
    const mediaFiles: MediaFileMetadata[] = [];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/special.mp4',
      0,
      1
    );

    expect(result[0]).toEqual({
      absolutePath: '/path/to/special.mp4',
      seasonNumber: 0,
      episodeNumber: 1,
    });
  });

  it('should handle large season and episode numbers', () => {
    const mediaFiles: MediaFileMetadata[] = [];

    const result = updateMediaFileMetadatas(
      mediaFiles,
      '/path/to/file1.mp4',
      99,
      999
    );

    expect(result[0]).toEqual({
      absolutePath: '/path/to/file1.mp4',
      seasonNumber: 99,
      episodeNumber: 999,
    });
  });
});

describe('validateFileExists', () => {
  describe('POSIX paths', () => {
    it('should validate file exists when both input and filesystem files use POSIX format', () => {
      const filesystemFiles = [
        '/media/videos/episode1.mp4',
        '/media/videos/episode2.mp4',
        '/media/videos/episode3.mp4'
      ];

      const result = validateFileExists('/media/videos/episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error when POSIX path does not exist in filesystem files', () => {
      const filesystemFiles = [
        '/media/videos/episode1.mp4',
        '/media/videos/episode2.mp4'
      ];

      const result = validateFileExists('/media/videos/episode3.mp4', filesystemFiles);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Path "/media/videos/episode3.mp4" is not a file in the media folder');
    });

    it('should handle POSIX paths with special characters', () => {
      const filesystemFiles = [
        '/media/videos/show-name s01e01.mp4',
        '/media/videos/show-name s01e02.mp4'
      ];

      const result = validateFileExists('/media/videos/show-name s01e01.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Windows paths', () => {
    it('should validate file exists when input is Windows path and filesystem files are Windows paths', () => {
      const filesystemFiles = [
        'C:\\Users\\user\\Videos\\episode1.mp4',
        'C:\\Users\\user\\Videos\\episode2.mp4',
        'C:\\Users\\user\\Videos\\episode3.mp4'
      ];

      const result = validateFileExists('C:\\Users\\user\\Videos\\episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate file exists when input is Windows path and filesystem files are POSIX paths', () => {
      // Path.posix() converts Windows paths to uppercase drive letter: C:\ -> /C/
      const filesystemFiles = [
        '/C/Users/user/Videos/episode1.mp4',
        '/C/Users/user/Videos/episode2.mp4'
      ];

      const result = validateFileExists('C:\\Users\\user\\Videos\\episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should validate file exists when input is POSIX path and filesystem files are Windows paths', () => {
      // Path.posix() converts Windows paths to uppercase drive letter: C:\ -> /C/
      // So we need to match the converted format
      const filesystemFiles = [
        'C:\\Users\\user\\Videos\\episode1.mp4',
        'C:\\Users\\user\\Videos\\episode2.mp4'
      ];

      // Input POSIX path with uppercase C to match what Windows paths convert to
      const result = validateFileExists('/C/Users/user/Videos/episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should return error when Windows path does not exist', () => {
      const filesystemFiles = [
        'C:\\Users\\user\\Videos\\episode1.mp4',
        'C:\\Users\\user\\Videos\\episode2.mp4'
      ];

      const result = validateFileExists('C:\\Users\\user\\Videos\\episode3.mp4', filesystemFiles);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('episode3.mp4');
    });

    it('should handle Windows paths with spaces', () => {
      const filesystemFiles = [
        'C:\\Users\\user\\My Videos\\episode1.mp4',
        'C:\\Users\\user\\My Videos\\episode2.mp4'
      ];

      const result = validateFileExists('C:\\Users\\user\\My Videos\\episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should handle Windows paths with different drive letters', () => {
      const filesystemFiles = [
        'D:\\Media\\Videos\\episode1.mp4',
        'D:\\Media\\Videos\\episode2.mp4'
      ];

      const result = validateFileExists('D:\\Media\\Videos\\episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Windows network paths', () => {
    it('should validate file exists when both input and filesystem files use Windows network path format', () => {
      const filesystemFiles = [
        '\\\\server\\share\\videos\\episode1.mp4',
        '\\\\server\\share\\videos\\episode2.mp4',
        '\\\\server\\share\\videos\\episode3.mp4'
      ];

      const result = validateFileExists('\\\\server\\share\\videos\\episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate file exists when input is Windows network path and filesystem files are POSIX paths', () => {
      const filesystemFiles = [
        '/server/share/videos/episode1.mp4',
        '/server/share/videos/episode2.mp4'
      ];

      const result = validateFileExists('\\\\server\\share\\videos\\episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should validate file exists when input is POSIX path and filesystem files are Windows network paths', () => {
      const filesystemFiles = [
        '\\\\server\\share\\videos\\episode1.mp4',
        '\\\\server\\share\\videos\\episode2.mp4'
      ];

      const result = validateFileExists('/server/share/videos/episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should return error when Windows network path does not exist', () => {
      const filesystemFiles = [
        '\\\\server\\share\\videos\\episode1.mp4',
        '\\\\server\\share\\videos\\episode2.mp4'
      ];

      const result = validateFileExists('\\\\server\\share\\videos\\episode3.mp4', filesystemFiles);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('episode3.mp4');
    });

    it('should handle Windows network paths with spaces in share name', () => {
      const filesystemFiles = [
        '\\\\server\\My Share\\videos\\episode1.mp4',
        '\\\\server\\My Share\\videos\\episode2.mp4'
      ];

      const result = validateFileExists('\\\\server\\My Share\\videos\\episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should handle Windows network paths with different server names', () => {
      const filesystemFiles = [
        '\\\\media-server\\videos\\episode1.mp4',
        '\\\\media-server\\videos\\episode2.mp4'
      ];

      const result = validateFileExists('\\\\media-server\\videos\\episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Mixed path formats', () => {
    it('should validate file exists when filesystem files contain mixed Windows and POSIX paths', () => {
      const filesystemFiles = [
        'C:\\Users\\user\\Videos\\episode1.mp4',
        '/media/videos/episode2.mp4',
        '\\\\server\\share\\videos\\episode3.mp4'
      ];

      const result = validateFileExists('C:\\Users\\user\\Videos\\episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should validate file exists when filesystem files contain mixed formats and input is POSIX', () => {
      const filesystemFiles = [
        'C:\\Users\\user\\Videos\\episode1.mp4',
        '/media/videos/episode2.mp4'
      ];

      const result = validateFileExists('/media/videos/episode2.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should validate file exists when filesystem files contain mixed formats and input is network path', () => {
      const filesystemFiles = [
        'C:\\Users\\user\\Videos\\episode1.mp4',
        '/media/videos/episode2.mp4',
        '\\\\server\\share\\videos\\episode3.mp4'
      ];

      const result = validateFileExists('\\\\server\\share\\videos\\episode3.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should return error when filesystemFiles array is empty', () => {
      const filesystemFiles: string[] = [];

      const result = validateFileExists('/path/to/file.mp4', filesystemFiles);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('file.mp4');
    });

    it('should handle paths with trailing slashes', () => {
      const filesystemFiles = [
        '/media/videos/episode1.mp4',
        '/media/videos/episode2.mp4'
      ];

      // The function should normalize paths, so trailing slashes should be handled
      const result = validateFileExists('/media/videos/episode1.mp4/', filesystemFiles);

      // Note: This depends on how Path.posix handles trailing slashes
      // The test verifies the function doesn't crash
      expect(result).toHaveProperty('isValid');
    });

    it('should handle very long paths', () => {
      const longPath = '/media/' + 'videos/'.repeat(50) + 'episode1.mp4';
      const filesystemFiles = [longPath];

      const result = validateFileExists(longPath, filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should handle paths with unicode characters', () => {
      const filesystemFiles = [
        '/media/videos/épisode1.mp4',
        '/media/videos/节目1.mp4'
      ];

      const result = validateFileExists('/media/videos/épisode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should handle case-sensitive matching (POSIX paths)', () => {
      const filesystemFiles = [
        '/media/videos/Episode1.mp4',
        '/media/videos/episode2.mp4'
      ];

      // Case-sensitive: should not match
      const result1 = validateFileExists('/media/videos/episode1.mp4', filesystemFiles);
      expect(result1.isValid).toBe(false);

      // Case-sensitive: should match
      const result2 = validateFileExists('/media/videos/Episode1.mp4', filesystemFiles);
      expect(result2.isValid).toBe(true);
    });

    it('should handle multiple files with same name in different directories', () => {
      const filesystemFiles = [
        '/media/videos/season1/episode1.mp4',
        '/media/videos/season2/episode1.mp4',
        '/media/videos/season3/episode1.mp4'
      ];

      const result = validateFileExists('/media/videos/season2/episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(true);
    });

    it('should return error for file in different directory with same name', () => {
      const filesystemFiles = [
        '/media/videos/season1/episode1.mp4',
        '/media/videos/season2/episode1.mp4'
      ];

      const result = validateFileExists('/media/videos/season3/episode1.mp4', filesystemFiles);

      expect(result.isValid).toBe(false);
    });
  });

});

describe('validateAllFiles', () => {
  /**
   * This test reproduces the exact error scenario reported by the user.
   * When input paths use /FNOS/ format but filesystem files use /F/ format,
   * they should be normalized and match properly.
   * 
   * This test expects validation to PASS (all files validated successfully), so it will:
   * - FAIL first (reproducing the bug) when the code doesn't handle normalization
   * - PASS once the code is fixed to properly normalize paths
   */
  it('should validate all files successfully when paths have mount point format mismatch but represent same files', () => {
    // Create mock TMDB TV show data
    const tmdbTvShow: NonNullable<MediaMetadata['tmdbTvShow']> = {
      id: 12345,
      name: 'Yamada\'s First Time',
      seasons: [
        {
          season_number: 1,
          episodes: [
            { episode_number: 7 },
            { episode_number: 8 },
            { episode_number: 10 },
          ],
        },
      ],
    };

    // Filesystem files normalized from Windows path F:\Media\... to POSIX /F/Media/...
    const filesystemFiles = [
      '/F/Media/anime/B型H系/[KH] Yamada\'s First Time - 07 - A Huge Duel with School Swimsuits! I Definitely Won\'t to Lose to You!.mkv',
      '/F/Media/anime/B型H系/[KH] Yamada\'s First Time - 08 - Yay, Field Trip! But We\'re Not Alone Together....mkv',
      '/F/Media/anime/B型H系/[KH] Yamada\'s First Time - 10 - The Kanejō Family. The Celebrity Brother\'s Dazzling Secret!.mkv',
    ];

    // Input files use /FNOS/Media/... format (different mount representation, but same files)
    // /FNOS/ should be normalized to /F/ before comparison
    const files = [
      {
        season: 1,
        episode: 7,
        path: '/FNOS/Media/anime/B型H系/[KH] Yamada\'s First Time - 07 - A Huge Duel with School Swimsuits! I Definitely Won\'t to Lose to You!.mkv',
      },
      {
        season: 1,
        episode: 8,
        path: '/FNOS/Media/anime/B型H系/[KH] Yamada\'s First Time - 08 - Yay, Field Trip! But We\'re Not Alone Together....mkv',
      },
      {
        season: 1,
        episode: 10,
        path: '/FNOS/Media/anime/B型H系/[KH] Yamada\'s First Time - 10 - The Kanejō Family. The Celebrity Brother\'s Dazzling Secret!.mkv',
      },
    ];

    const result = validateAllFiles(files, filesystemFiles, tmdbTvShow);

    // Should have all 3 files validated successfully (no errors)
    // This test will FAIL first (reproducing the bug), then PASS once fixed
    expect(result.validatedFiles).toHaveLength(3);
    expect(result.validationErrors).toHaveLength(0);
    
    // Verify all files were validated
    expect(result.validatedFiles[0]?.path).toBe(files[0].path);
    expect(result.validatedFiles[0]?.season).toBe(1);
    expect(result.validatedFiles[0]?.episode).toBe(7);
    
    expect(result.validatedFiles[1]?.path).toBe(files[1].path);
    expect(result.validatedFiles[1]?.season).toBe(1);
    expect(result.validatedFiles[1]?.episode).toBe(8);
    
    expect(result.validatedFiles[2]?.path).toBe(files[2].path);
    expect(result.validatedFiles[2]?.season).toBe(1);
    expect(result.validatedFiles[2]?.episode).toBe(10);
  });
});

