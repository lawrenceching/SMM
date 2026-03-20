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
      const result = (await searchTvdb({ keyword: 'test', type: 'tv' })) as any;
      expect(result.error).toBeDefined();
      expect(result.error).toContain('API key');
    });

    it('getTvdbSeries returns error', async () => {
      const result = (await getTvdbSeries(123)) as any;
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });

    it('getTvdbMovie returns error', async () => {
      const result = (await getTvdbMovie(456)) as any;
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
      const result = (await searchTvdb({ keyword: 'test', type: 'movie' })) as any;
      expect(result.error).toBeDefined();
    });
  });

  describe('searchTvdb forwards language to TVDB query string', () => {
    beforeAll(() => {
      const configPath = path.join(testDir, 'smm.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ tvdb: { host: 'https://api4.thetvdb.com/v4', apiKey: 'test-key' } }),
        'utf-8'
      );
    });

    it('includes language in GET /search when provided', async () => {
      const urls: string[] = [];
      globalThis.fetch = vi.fn(async (input: any) => {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        urls.push(u);
        if (u.includes('/login')) {
          return new Response(JSON.stringify({ data: { token: 'fake-token' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as unknown as typeof fetch;

      const result = (await searchTvdb({ keyword: 'test', type: 'tv', language: 'eng' })) as any;
      expect(result.data).toEqual([]);
      const searchCall = urls.find((u) => u.includes('/search'));
      expect(searchCall).toBeDefined();
      expect(searchCall).toContain('language=eng');
      expect(searchCall).toContain('type=series');
      expect(searchCall).toContain('query=test');

      globalThis.fetch = originalFetch;
    });
  });

  describe('extended detail endpoints are used', () => {
    beforeAll(() => {
      const configPath = path.join(testDir, 'smm.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ tvdb: { host: 'https://api4.thetvdb.com/v4', apiKey: 'test-key' } }),
        'utf-8'
      );
    });

    it('getTvdbSeries uses /series/{id}/extended', async () => {
      const urls: string[] = [];
      globalThis.fetch = vi.fn(async (input: any) => {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        urls.push(u);
        if (u.includes('/login')) {
          return new Response(JSON.stringify({ data: { token: 'fake-token' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ data: { id: 100 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as unknown as typeof fetch;

      const result = (await getTvdbSeries(100)) as any;
      expect(result.data?.id).toBe(100);
      expect(urls.some((u) => u.includes('/series/100/extended'))).toBe(true);
      globalThis.fetch = originalFetch;
    });

    it('getTvdbMovie uses /movies/{id}/extended', async () => {
      const urls: string[] = [];
      globalThis.fetch = vi.fn(async (input: any) => {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        urls.push(u);
        if (u.includes('/login')) {
          return new Response(JSON.stringify({ data: { token: 'fake-token' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ data: { id: 200 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as unknown as typeof fetch;

      const result = (await getTvdbMovie(200)) as any;
      expect(result.data?.id).toBe(200);
      expect(urls.some((u) => u.includes('/movies/200/extended'))).toBe(true);
      globalThis.fetch = originalFetch;
    });
  });
});
