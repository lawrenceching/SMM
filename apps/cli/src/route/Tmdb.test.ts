import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getTvShow, getMovie, search } from './Tmdb';
import { getUserDataDir } from '@/utils/config';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('@/utils/config');

const TMDB_HOST = 'https://tmdb-mcp-server.imlc.me';
let testDir: string;
let originalBun: typeof globalThis.Bun;

describe('Tmdb (real fetch)', () => {
  beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smm-tmdb-test-'));
    const configPath = path.join(testDir, 'smm.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ tmdb: { host: TMDB_HOST } }),
      'utf-8'
    );
    vi.mocked(getUserDataDir).mockReturnValue(testDir);

    // Tmdb.ts uses Bun.file() to read config; Vitest runs in Node so Bun is undefined.
    // Stub Bun.file to use Node fs so config is read from our test dir (fetch stays real).
    originalBun = (globalThis as any).Bun;
    (globalThis as any).Bun = {
      file: (p: string) => ({
        exists: () => Promise.resolve(fs.existsSync(p)),
        text: () => Promise.resolve(fs.readFileSync(p, 'utf-8')),
      }),
    };
  });

  afterAll(() => {
    (globalThis as any).Bun = originalBun;
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    vi.restoreAllMocks();
  });

  it('getTvShow returns show for id 123876', async () => {
    const result = await getTvShow(123876);

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data?.id).toBe(123876);
    expect(result.data).toHaveProperty('name');
    expect(result.data).toHaveProperty('seasons');
  }, 10000);

  it('getMovie returns movie for id 1084244', async () => {
    const result = await getMovie(1084244);

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data?.id).toBe(1084244);
    expect(result.data).toHaveProperty('title');
  }, 10000);

  it('search returns results for keyword "古见同学"', async () => {
    const result = await search({
      keyword: '古见同学',
      type: 'tv',
      language: 'zh-CN',
    });

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.total_results).toBeGreaterThanOrEqual(0);
    if (result.results.length > 0) {
      const hasMatch = result.results.some(
        (r) =>
          ('name' in r && String(r.name).includes('古见')) ||
          ('title' in r && String(r.title).includes('古见'))
      );
      expect(hasMatch).toBe(true);
    }
  }, 10000);
});
