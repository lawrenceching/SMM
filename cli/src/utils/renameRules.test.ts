import { describe, it, expect } from 'bun:test';
import { generateFileNameByJavaScript, plex } from './renameRules';

describe('generateFileNameByJavaScript', () => {
  it('PLEX - TV Show', () => {
    const context = {
      type: 'tv' as const,
      seasonNumber: 1,
      episodeNumber: 5,
      episodeName: 'The Pilot',
      tvshowName: 'Breaking Bad',
      file: 'The Pilot [1080P].mp4',
      tmdbId: '1396',
      releaseYear: '2008',
    };

    const result = generateFileNameByJavaScript(plex, context);

    console.log(`Execution result: ` + result);
    
    expect(result).toBe('Season 01/Breaking Bad - S01E05 - The Pilot.mp4')
  });

  it('PLEX - Movie', () => {
    const context = {
      type: 'movie' as const,
      seasonNumber: 0,
      episodeNumber: 0,
      episodeName: 'The Dark Knight',
      tvshowName: 'The Dark Knight',
      movieName: 'The Dark Knight',
      file: 'The Dark Knight [1080P].mp4',
      tmdbId: '155',
      releaseYear: '2008',
    };

    const result = generateFileNameByJavaScript(plex, context);

    console.log(`Execution result: ` + result);
    
    expect(result).toBe('The Dark Knight (2008).mp4')
  });
});

