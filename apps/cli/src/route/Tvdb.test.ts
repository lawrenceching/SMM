import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { searchTvdb, getTvdbSeries, getTvdbMovie } from './Tvdb';
import { getUserDataDir } from '@/utils/config';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('@/utils/config');

let testDir: string;
let originalBun: typeof globalThis.Bun;
let originalFetch: typeof globalThis.fetch;

describe('Tvdb', () => {
  beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smm-tvdb-test-'));
    vi.mocked(getUserDataDir).mockReturnValue(testDir);
    originalBun = (globalThis as any).Bun;
    originalFetch = globalThis.fetch;
    (globalThis as any).Bun = {
      file: (p: string) => ({
        exists: () => Promise.resolve(fs.existsSync(p)),
        text: () => Promise.resolve(fs.readFileSync(p, 'utf-8')),
      }),
    };
  });

  afterAll(() => {
    (globalThis as any).Bun = originalBun;
    globalThis.fetch = originalFetch;
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    vi.restoreAllMocks();
  });

  describe('when TVDB API key is not configured', () => {
    beforeAll(() => {
      const configPath = path.join(testDir, 'smm.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ tvdb: { host: 'https://api4.thetvdb.com/v4' } }),
        'utf-8'
      );
    });

    it('searchTvdb returns error', async () => {
      const result = await searchTvdb({ keyword: 'test', type: 'tv' });
      expect(result.error).toBeDefined();
      expect(result.results).toEqual([]);
      expect(result.error).toContain('API key');
    });

    it('getTvdbSeries returns error', async () => {
      const result = await getTvdbSeries(123);
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });

    it('getTvdbMovie returns error', async () => {
      const result = await getTvdbMovie(456);
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('when user config is missing', () => {
    beforeAll(() => {
      const configPath = path.join(testDir, 'smm.json');
      if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    });

    it('searchTvdb returns error', async () => {
      const result = await searchTvdb({ keyword: 'test', type: 'movie' });
      expect(result.error).toBeDefined();
      expect(result.results).toEqual([]);
    });
  });
});
