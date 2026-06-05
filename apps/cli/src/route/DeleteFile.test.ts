import { describe, it, expect, vi, beforeEach } from 'vitest';
import { doDeleteFile } from './DeleteFile';

vi.mock('@/utils/config', () => ({
  getUserDataDir: vi.fn(() => 'C:/Users/me/AppData/SMM'),
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    stat: vi.fn(),
  };
});

vi.mock('../utils/files', () => ({
  permanentlyDeleteFile: vi.fn(),
}));

import { stat } from 'node:fs/promises';
import { permanentlyDeleteFile } from '../utils/files';

describe('doDeleteFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects paths outside managed cookies allowlist', async () => {
    const result = await doDeleteFile({ path: 'C:/Users/me/Downloads/song.mp3' });
    expect(result.error).toContain('not an allowed managed');
    expect(permanentlyDeleteFile).not.toHaveBeenCalled();
  });

  it('permanently deletes managed cookies file', async () => {
    vi.mocked(stat).mockResolvedValue({ isFile: () => true } as Awaited<ReturnType<typeof stat>>);
    vi.mocked(permanentlyDeleteFile).mockResolvedValue(undefined);

    const cookiesPath = 'C:/Users/me/AppData/SMM/temp/ytdlp-cookies-job-1.txt';
    const result = await doDeleteFile({ path: cookiesPath });

    expect(result.error).toBeUndefined();
    expect(result.data?.path).toBeTruthy();
    expect(permanentlyDeleteFile).toHaveBeenCalled();
  });
});
