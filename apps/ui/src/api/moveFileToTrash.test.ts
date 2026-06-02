import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moveFileToTrash } from './moveFileToTrash';

describe('moveFileToTrash', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns data on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { path: 'C:\\media\\song.mp3' } }),
      }),
    );

    const result = await moveFileToTrash('C:\\media\\song.mp3');
    expect(result.data?.path).toBe('C:\\media\\song.mp3');
    expect(fetch).toHaveBeenCalledWith(
      '/api/moveFileToTrash',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ path: 'C:\\media\\song.mp3' }),
      }),
    );
  });

  it('throws when response body contains error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { path: 'C:\\media\\song.mp3' },
          error: 'File Not Found: missing',
        }),
      }),
    );

    await expect(moveFileToTrash('C:\\media\\song.mp3')).rejects.toThrow('File Not Found');
  });

  it('throws on non-OK HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => '',
      }),
    );

    await expect(moveFileToTrash('C:\\media\\song.mp3')).rejects.toThrow('HTTP Layer Error');
  });
});
