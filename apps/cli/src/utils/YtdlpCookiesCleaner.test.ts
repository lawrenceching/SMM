import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { YtdlpCookiesCleaner } from './YtdlpCookiesCleaner';

vi.mock('./files', () => ({
  permanentlyDeleteFile: vi.fn(),
}));

import { permanentlyDeleteFile } from './files';

describe('YtdlpCookiesCleaner', () => {
  let userDataDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    userDataDir = await mkdtemp(path.join(tmpdir(), 'smm-ytdlp-cookies-'));
    vi.mocked(permanentlyDeleteFile).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it('returns zeros when temp dir does not exist', async () => {
    const cleaner = new YtdlpCookiesCleaner({
      userDataDir: path.join(userDataDir, 'missing'),
    });

    const result = await cleaner.cleanAll();

    expect(result).toEqual({ removed: 0, failed: 0, remaining: 0 });
    expect(permanentlyDeleteFile).not.toHaveBeenCalled();
  });

  it('returns zeros for an empty temp dir', async () => {
    await mkdir(path.join(userDataDir, 'temp'), { recursive: true });

    const cleaner = new YtdlpCookiesCleaner({ userDataDir });
    const result = await cleaner.cleanAll();

    expect(result).toEqual({ removed: 0, failed: 0, remaining: 0 });
    expect(permanentlyDeleteFile).not.toHaveBeenCalled();
  });

  it('deletes only managed cookies files', async () => {
    const tempDir = path.join(userDataDir, 'temp');
    await mkdir(tempDir, { recursive: true });

    const managedPath = path.join(tempDir, 'ytdlp-cookies-job-1.txt');
    const otherPath = path.join(tempDir, 'notes.txt');
    await writeFile(managedPath, 'cookies');
    await writeFile(otherPath, 'other');

    const cleaner = new YtdlpCookiesCleaner({ userDataDir });
    const result = await cleaner.cleanAll();

    expect(result).toEqual({ removed: 1, failed: 0, remaining: 0 });
    expect(permanentlyDeleteFile).toHaveBeenCalledTimes(1);
    expect(permanentlyDeleteFile).toHaveBeenCalledWith(managedPath);
  });

  it('continues when some deletes fail', async () => {
    const tempDir = path.join(userDataDir, 'temp');
    await mkdir(tempDir, { recursive: true });

    const first = path.join(tempDir, 'ytdlp-cookies-a.txt');
    const second = path.join(tempDir, 'ytdlp-cookies-b.txt');
    await writeFile(first, 'a');
    await writeFile(second, 'b');

    vi.mocked(permanentlyDeleteFile)
      .mockRejectedValueOnce(new Error('EBUSY'))
      .mockResolvedValueOnce(undefined);

    const cleaner = new YtdlpCookiesCleaner({ userDataDir });
    const result = await cleaner.cleanAll();

    expect(result).toEqual({ removed: 1, failed: 1, remaining: 1 });
    expect(permanentlyDeleteFile).toHaveBeenCalledTimes(2);
  });
});
