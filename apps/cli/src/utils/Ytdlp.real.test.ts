import { describe, it, expect } from 'vitest';
import { extractVideoData } from './Ytdlp';

describe('extractVideoData (real yt-dlp)', () => {
  it('should extract title and artist from real Bilibili video', async () => {
    const result = await extractVideoData('https://www.bilibili.com/video/BV1wacpz9EXn');

    expect(result.error).toBeUndefined();
    expect(result.title).toBe('紧急出口(Full ver.) / 初音ミク【原创曲】');
    expect(result.artist).toBe('小绵羊magens');
  }, 60000);
});
