import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractVideoData } from './Ytdlp';

const { mockExecSync } = vi.hoisted(() => {
  return { mockExecSync: vi.fn() };
});

vi.mock('child_process', () => ({
  execSync: mockExecSync,
}));

vi.mock('./config', () => ({
  getUserConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
  };
});

describe('extractVideoData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when URL is empty', async () => {
    const result = await extractVideoData('');
    expect(result.error).toBe('url is required');
  });

  it('should return error when URL is not provided', async () => {
    const result = await extractVideoData(undefined as unknown as string);
    expect(result.error).toBe('url is required');
  });

  it('should return error when yt-dlp executable is not found', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('yt-dlp not found');
    });

    const result = await extractVideoData('https://www.bilibili.com/video/BV1wacpz9EXn');
    expect(result.error).toBe('yt-dlp failed: yt-dlp not found');
  });

  it('should extract title and artist from valid URL', async () => {
    mockExecSync.mockReturnValue(
      'title=紧急出口(Full ver.) / 初音ミク【原创曲】 ___ artist=小绵羊magens'
    );

    const result = await extractVideoData('https://www.bilibili.com/video/BV1wacpz9EXn');

    expect(result.title).toBe('紧急出口(Full ver.) / 初音ミク【原创曲】');
    expect(result.artist).toBe('小绵羊magens');
    expect(result.error).toBeUndefined();
  });

  it('should handle output with warnings before data line', async () => {
    mockExecSync.mockReturnValue(
      'yt-dlp version 2023.12.30\ntitle=Test Video ___ artist=Test Artist'
    );

    const result = await extractVideoData('https://www.youtube.com/watch?v=test');

    expect(result.title).toBe('Test Video');
    expect(result.artist).toBe('Test Artist');
  });

  it('should return error when output format is unexpected', async () => {
    mockExecSync.mockReturnValue('unexpected output format');

    const result = await extractVideoData('https://www.bilibili.com/video/BV1wacpz9EXn');

    expect(result.error).toBe('failed to parse video data from output');
  });

  it('should return error when title is missing from output', async () => {
    mockExecSync.mockReturnValue('title= ___ artist=SomeArtist');

    const result = await extractVideoData('https://www.bilibili.com/video/BV1wacpz9EXn');

    expect(result.error).toBe('title not found in yt-dlp output');
  });

  it('should handle invalid URL error from yt-dlp', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('ERROR: URL must start with http');
    });

    const result = await extractVideoData('invalid-url');

    expect(result.error).toBe('invalid URL provided');
  });

  it('should handle timeout error from yt-dlp', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Execution timeout');
    });

    const result = await extractVideoData('https://www.bilibili.com/video/BV1wacpz9EXn');

    expect(result.error).toBe('request timed out');
  });

  it('should handle generic execution errors', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Network connection failed');
    });

    const result = await extractVideoData('https://www.bilibili.com/video/BV1wacpz9EXn');

    expect(result.error).toBe('yt-dlp failed: Network connection failed');
  });

  it('should handle unknown errors', async () => {
    mockExecSync.mockImplementation(() => {
      throw 'unknown error';
    });

    const result = await extractVideoData('https://www.bilibili.com/video/BV1wacpz9EXn');

    expect(result.error).toBe('unknown error occurred while extracting video data');
  });

  it('should handle missing artist gracefully', async () => {
    mockExecSync.mockReturnValue('title=Video With No Artist ___ artist=');

    const result = await extractVideoData('https://www.bilibili.com/video/BV1wacpz9EXn');

    expect(result.title).toBe('Video With No Artist');
    expect(result.artist).toBe('');
  });
});
