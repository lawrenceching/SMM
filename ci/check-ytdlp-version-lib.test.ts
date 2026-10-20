import { describe, expect, test } from 'bun:test';
import {
  normalizeYtdlpReleaseTag,
  readPinnedYtdlpVersion,
  setPinnedYtdlpVersion,
  ytdlpNeedsBump,
} from './check-ytdlp-version-lib';

const samplePkg = `{
  "private": true,
  "3pp": {
    "ffmpeg_version": "8.1",
    "ytdlp_version": "2026.07.04",
    "videocaptioner_upstream_version": "1.4.2"
  }
}
`;

describe('check-ytdlp-version-lib', () => {
  test('readPinnedYtdlpVersion reads 3pp.ytdlp_version', () => {
    expect(readPinnedYtdlpVersion(samplePkg)).toBe('2026.07.04');
  });

  test('normalizeYtdlpReleaseTag strips optional leading v', () => {
    expect(normalizeYtdlpReleaseTag('2026.09.01')).toBe('2026.09.01');
    expect(normalizeYtdlpReleaseTag('v2026.09.01')).toBe('2026.09.01');
  });

  test('ytdlpNeedsBump is false when versions match', () => {
    expect(ytdlpNeedsBump('2026.07.04', '2026.07.04')).toBe(false);
    expect(ytdlpNeedsBump('2026.07.04', 'v2026.07.04')).toBe(false);
  });

  test('ytdlpNeedsBump is true when latest differs', () => {
    expect(ytdlpNeedsBump('2026.07.04', '2026.09.01')).toBe(true);
  });

  test('setPinnedYtdlpVersion updates only ytdlp_version and keeps valid JSON', () => {
    const next = setPinnedYtdlpVersion(samplePkg, '2026.09.01');
    const parsed = JSON.parse(next) as { '3pp': { ytdlp_version: string; ffmpeg_version: string } };
    expect(parsed['3pp'].ytdlp_version).toBe('2026.09.01');
    expect(parsed['3pp'].ffmpeg_version).toBe('8.1');
    expect(readPinnedYtdlpVersion(next)).toBe('2026.09.01');
  });
});
