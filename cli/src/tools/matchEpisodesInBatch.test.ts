import { describe, it, expect } from 'bun:test';
import { updateMediaFileMetadatas } from './matchEpisodesInBatch';
import type { MediaFileMetadata } from '@core/types';

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

