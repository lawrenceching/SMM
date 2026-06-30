import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  PINNED_CHROME_VERSION,
  repairWdioBrowserCache,
} from './ensure-wdio-cache.ts';

let tmpCacheDir: string;

beforeEach(() => {
  tmpCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdio-cache-test-'));
});

afterEach(() => {
  fs.rmSync(tmpCacheDir, { recursive: true, force: true });
});

describe('repairWdioBrowserCache', () => {
  test('removes version dirs missing the executable', () => {
    const platformId =
      process.platform === 'win32'
        ? `win64-${PINNED_CHROME_VERSION}`
        : process.platform === 'darwin'
          ? `mac-arm64-${PINNED_CHROME_VERSION}`
          : `linux-${PINNED_CHROME_VERSION}`;

    const brokenDir = path.join(
      tmpCacheDir,
      'chromedriver',
      platformId,
      'chromedriver-linux64',
    );
    fs.mkdirSync(brokenDir, { recursive: true });

    const removed = repairWdioBrowserCache(tmpCacheDir);

    expect(removed.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(tmpCacheDir, 'chromedriver', platformId))).toBe(
      false,
    );
  });

  test('keeps version dirs with a valid executable', () => {
    const platformId =
      process.platform === 'win32'
        ? `win64-${PINNED_CHROME_VERSION}`
        : process.platform === 'darwin'
          ? `mac-arm64-${PINNED_CHROME_VERSION}`
          : `linux-${PINNED_CHROME_VERSION}`;

    const exeName =
      process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
    const exeDir =
      process.platform === 'win32'
        ? path.join(tmpCacheDir, 'chromedriver', platformId, 'chromedriver-win64')
        : process.platform === 'darwin'
          ? path.join(
              tmpCacheDir,
              'chromedriver',
              platformId,
              'chromedriver-mac-arm64',
            )
          : path.join(
              tmpCacheDir,
              'chromedriver',
              platformId,
              'chromedriver-linux64',
            );

    fs.mkdirSync(exeDir, { recursive: true });
    fs.writeFileSync(path.join(exeDir, exeName), '');

    const removed = repairWdioBrowserCache(tmpCacheDir);

    expect(removed).toEqual([]);
    expect(fs.existsSync(path.join(exeDir, exeName))).toBe(true);
  });
});
