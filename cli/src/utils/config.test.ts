import { describe, it, expect } from 'bun:test';
import { renameFolderInUserConfig } from './config';
import type { UserConfig } from '@core/types';
import { Path } from '@core/path';

describe('renameFolderInUserConfig', () => {
  const createMockUserConfig = (folders: string[]): UserConfig => ({
    applicationLanguage: 'en-US',
    tmdb: {
      apiKey: 'test-key',
      host: 'https://api.themoviedb.org/3',
    },
    renameRules: [],
    folders,
    dryRun: false,
    selectedRenameRule: 'Plex(TvShow/Anime)',
  });

  it('should rename folder when folders contain POSIX path', () => {
    const from = '/media/movies';
    const to = '/media/films';
    const userConfig = createMockUserConfig([
      '/media/movies',
      '/media/tv-shows',
      '/media/documentaries',
    ]);

    const result = renameFolderInUserConfig(userConfig, from, to);

    expect(result.folders).toContain(Path.toPlatformPath(to));
    expect(result.folders).not.toContain(Path.posix(from));
    expect(result.folders).toEqual([
      Path.toPlatformPath(to),
      '/media/tv-shows',
      '/media/documentaries',
    ]);
  });

  it('should rename folder when folders contain Windows path', () => {
    const from = '/media/movies';
    const to = '/media/films';
    const fromWindows = Path.win(from);
    const userConfig = createMockUserConfig([
      fromWindows,
      'C:\\media\\tv-shows',
      'C:\\media\\documentaries',
    ]);

    const result = renameFolderInUserConfig(userConfig, from, to);

    expect(result.folders).toContain(Path.toPlatformPath(to));
    expect(result.folders).not.toContain(fromWindows);
    expect(result.folders[0]).toBe(Path.toPlatformPath(to));
    expect(result.folders[1]).toBe('C:\\media\\tv-shows');
    expect(result.folders[2]).toBe('C:\\media\\documentaries');
  });

  it('should rename folder when folders contain both POSIX and Windows paths', () => {
    const from = '/media/movies';
    const to = '/media/films';
    const fromPosix = Path.posix(from);
    const fromWindows = Path.win(from);
    const userConfig = createMockUserConfig([
      fromPosix,
      fromWindows,
      '/media/tv-shows',
      'C:\\media\\documentaries',
    ]);

    const result = renameFolderInUserConfig(userConfig, from, to);

    expect(result.folders).toContain(Path.toPlatformPath(to));
    expect(result.folders).not.toContain(fromPosix);
    expect(result.folders).not.toContain(fromWindows);
    // Both POSIX and Windows versions should be replaced
    const toPlatform = Path.toPlatformPath(to);
    expect(result.folders.filter(f => f === toPlatform).length).toBe(2);
    expect(result.folders).toContain('/media/tv-shows');
    expect(result.folders).toContain('C:\\media\\documentaries');
  });

  it('should not modify folders when from path does not match', () => {
    const from = '/media/movies';
    const to = '/media/films';
    const userConfig = createMockUserConfig([
      '/media/tv-shows',
      '/media/documentaries',
      'C:\\media\\other',
    ]);

    const result = renameFolderInUserConfig(userConfig, from, to);

    expect(result.folders).toEqual(userConfig.folders);
    expect(result.folders).not.toContain(Path.toPlatformPath(to));
  });

  it('should handle empty folders array', () => {
    const from = '/media/movies';
    const to = '/media/films';
    const userConfig = createMockUserConfig([]);

    const result = renameFolderInUserConfig(userConfig, from, to);

    expect(result.folders).toEqual([]);
  });

  it('should handle single folder in POSIX format', () => {
    const from = '/media/movies';
    const to = '/media/films';
    const userConfig = createMockUserConfig(['/media/movies']);

    const result = renameFolderInUserConfig(userConfig, from, to);

    expect(result.folders).toEqual([Path.toPlatformPath(to)]);
    expect(result.folders).not.toContain(Path.posix(from));
  });

  it('should handle single folder in Windows format', () => {
    const from = '/media/movies';
    const to = '/media/films';
    const fromWindows = Path.win(from);
    const userConfig = createMockUserConfig([fromWindows]);

    const result = renameFolderInUserConfig(userConfig, from, to);

    expect(result.folders).toEqual([Path.toPlatformPath(to)]);
    expect(result.folders).not.toContain(fromWindows);
  });

  it('should preserve other UserConfig properties', () => {
    const from = '/media/movies';
    const to = '/media/films';
    const userConfig: UserConfig = {
      applicationLanguage: 'zh-CN',
      tmdb: {
        apiKey: 'custom-key',
        host: 'https://custom.tmdb.org/3',
      },
      renameRules: [],
      folders: ['/media/movies'],
      dryRun: false,
      selectedRenameRule: 'Plex(TvShow/Anime)',
      ai: {
        deepseek: {},
        openAI: {
          apiKey: 'ai-key',
        },
        openrouter: {},
        glm: {},
        other: {},
      },
    };

    const result = renameFolderInUserConfig(userConfig, from, to);

    expect(result.applicationLanguage).toBe('zh-CN');
    expect(result.tmdb.apiKey).toBe('custom-key');
    expect(result.tmdb.host).toBe('https://custom.tmdb.org/3');
    expect(result.ai?.openAI?.apiKey).toBe('ai-key');
    expect(result.folders).toEqual([Path.toPlatformPath(to)]);
  });

  it('should handle complex paths with multiple segments', () => {
    const from = '/home/user/media/movies/action';
    const to = '/home/user/media/films/action';
    const userConfig = createMockUserConfig([
      '/home/user/media/movies/action',
      '/home/user/media/movies/comedy',
      Path.win('/home/user/media/movies/action'),
    ]);

    const result = renameFolderInUserConfig(userConfig, from, to);

    const toPlatform = Path.toPlatformPath(to);
    expect(result.folders).toContain(toPlatform);
    expect(result.folders).not.toContain(Path.posix(from));
    expect(result.folders).not.toContain(Path.win(from));
    // Both matches should be replaced
    expect(result.folders.filter(f => f === toPlatform).length).toBe(2);
    expect(result.folders).toContain('/home/user/media/movies/comedy');
  });

  it('should not mutate original userConfig', () => {
    const from = '/media/movies';
    const to = '/media/films';
    const originalFolders = ['/media/movies', '/media/tv-shows'];
    const userConfig = createMockUserConfig(originalFolders);

    const result = renameFolderInUserConfig(userConfig, from, to);

    expect(userConfig.folders).toEqual(originalFolders);
    expect(result.folders).not.toEqual(originalFolders);
  });
});

