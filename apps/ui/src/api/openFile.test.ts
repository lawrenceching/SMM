import { afterEach, describe, expect, it, vi } from 'vitest';
import { openFile } from './openFile';

const OPEN_FILE_CHANNEL = 'open-file';

describe('openFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as Window & { api?: unknown }).api;
  });

  it('uses executeChannel when window.api is available', async () => {
    const executeChannel = vi.fn(async () => ({
      name: OPEN_FILE_CHANNEL,
      data: { success: true },
    }));

    (window as Window & { api?: { executeChannel: typeof executeChannel } }).api = {
      executeChannel,
    };

    const result = await openFile('/tmp/fanart.jpg');

    expect(executeChannel).toHaveBeenCalledWith({
      name: OPEN_FILE_CHANNEL,
      data: '/tmp/fanart.jpg',
    });
    expect(result).toEqual({ data: { path: '/tmp/fanart.jpg' } });
  });

  it('returns error from executeChannel when open fails', async () => {
    const executeChannel = vi.fn(async () => ({
      name: OPEN_FILE_CHANNEL,
      data: { success: false, error: 'Failed to open path' },
    }));

    (window as Window & { api?: { executeChannel: typeof executeChannel } }).api = {
      executeChannel,
    };

    const result = await openFile('/tmp/missing.jpg');

    expect(result).toEqual({
      data: { path: '/tmp/missing.jpg' },
      error: 'Failed to open path',
    });
  });

  it('falls back to HTTP when executeChannel is unavailable', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      url: 'http://localhost/api/openFile',
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: { path: '/tmp/track.mp3' } }),
    }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await openFile('/tmp/track.mp3');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/openFile',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ path: '/tmp/track.mp3' }),
      }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(result).toEqual({ data: { path: '/tmp/track.mp3' } });
  });
});
