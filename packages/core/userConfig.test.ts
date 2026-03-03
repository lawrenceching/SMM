import { describe, it, expect } from 'vitest';
import { renameFolderInUserConfig } from './userConfig';
import { Path } from './path';
import type { UserConfig } from './types';

function createMockUserConfig(overrides: Partial<UserConfig> = {}): UserConfig {
  return {
    applicationLanguage: 'en',
    tmdb: {},
    folders: overrides.folders ?? [],
    renameRules: [],
    dryRun: false,
    selectedRenameRule: '',
    ...overrides,
  } as UserConfig;
}

describe('renameFolderInUserConfig', () => {
  it('returns a new config with the matching folder path replaced (POSIX from)', () => {
    const fromPosix = '/home/user/Media';
    const toPosix = '/home/user/MediaRenamed';
    const expectedTo = Path.toPlatformPath(toPosix);

    const config = createMockUserConfig({
      folders: [fromPosix, '/other/folder'],
    });

    const result = renameFolderInUserConfig(config, fromPosix, toPosix);

    expect(result).not.toBe(config);
    expect(result.folders).toEqual([expectedTo, '/other/folder']);
  });

  it('replaces folder when config stores path in Windows format', () => {
    // "from" is given in POSIX; Path.win(from) produces Windows form that may be stored in config
    const fromPosix = '/home/user/Media';
    const toPosix = '/home/user/MediaRenamed';
    const fromWindows = Path.win(fromPosix);
    const expectedTo = Path.toPlatformPath(toPosix);

    const config = createMockUserConfig({
      folders: [fromWindows, '/other/folder'],
    });

    const result = renameFolderInUserConfig(config, fromPosix, toPosix);

    expect(result.folders).toEqual([expectedTo, '/other/folder']);
  });

  it('replaces folder when "from" is given in Windows format', () => {
    const fromWindows = 'C:\\Users\\Media';
    const fromPosix = Path.posix(fromWindows); // /C/Users/Media
    const toPosix = '/C/Users/MediaRenamed';
    const expectedTo = Path.toPlatformPath(toPosix);

    const config = createMockUserConfig({
      folders: [fromPosix],
    });

    const result = renameFolderInUserConfig(config, fromWindows, toPosix);

    expect(result.folders).toEqual([expectedTo]);
  });

  it('leaves folders unchanged when no folder matches "from"', () => {
    const config = createMockUserConfig({
      folders: ['/home/a', '/home/b'],
    });

    const result = renameFolderInUserConfig(config, '/home/c', '/home/d');

    expect(result.folders).toEqual(['/home/a', '/home/b']);
  });

  it('returns new config with empty folders when folders was empty', () => {
    const config = createMockUserConfig({ folders: [] });

    const result = renameFolderInUserConfig(config, '/home/old', '/home/new');

    expect(result.folders).toEqual([]);
    expect(result).not.toBe(config);
  });

  it('preserves all other userConfig fields', () => {
    const config = createMockUserConfig({
      folders: ['/home/Media'],
      applicationLanguage: 'zh-CN',
      dryRun: true,
      selectedRenameRule: 'rule1',
    });

    const result = renameFolderInUserConfig(config, '/home/Media', '/home/MediaNew');

    expect(result.applicationLanguage).toBe('zh-CN');
    expect(result.dryRun).toBe(true);
    expect(result.selectedRenameRule).toBe('rule1');
    expect(result.tmdb).toBe(config.tmdb);
  });

  it('replaces all occurrences of the same folder path', () => {
    const from = '/home/Media';
    const to = '/home/MediaNew';
    const expectedTo = Path.toPlatformPath(to);

    const config = createMockUserConfig({
      folders: [from, '/other', from],
    });

    const result = renameFolderInUserConfig(config, from, to);

    expect(result.folders).toEqual([expectedTo, '/other', expectedTo]);
  });

  it('normalizes "to" to platform path', () => {
    const from = '/home/Media';
    const toWindows = 'C:\\Users\\MediaNew';
    const expectedTo = Path.toPlatformPath(toWindows);

    const config = createMockUserConfig({ folders: [from] });

    const result = renameFolderInUserConfig(config, from, toWindows);

    expect(result.folders).toHaveLength(1);
    expect(result.folders[0]).toBe(expectedTo);
  });
});
