import { describe, it, expect } from 'bun:test';
import { generateFileNameByJavaScript, plex } from './renameRules';

describe('generateFileNameByJavaScript', () => {
  it('should generate filename using plex snippet', () => {
    const context = {
      type: 'tv' as const,
      seasonNumber: 1,
      episodeNumber: 5,
      episodeName: 'The Pilot',
      tvshowName: 'Breaking Bad',
      file: 'The Pilot [1080P].mp4',
    };

    const result = generateFileNameByJavaScript(plex, context);

    console.log(`Execution result: ` + result);
    
    expect(result).toBe('Season 01/Breaking Bad - S01E05 - The Pilot.mp4')
  });
});

