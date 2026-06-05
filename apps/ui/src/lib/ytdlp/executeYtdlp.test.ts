import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeYtdlp } from './executeYtdlp';

vi.mock('@/lib/whitelistedCmd/executeCmdToCompletion', () => ({
  executeCmdToCompletion: vi.fn(),
  executeCmdToCompletionWithHeaders: vi.fn(),
}));

vi.mock('@/lib/ytdlpCookiesFile', () => ({
  permanentlyDeleteYtdlpCookiesFile: vi.fn(),
}));

import { executeCmdToCompletion } from '@/lib/whitelistedCmd/executeCmdToCompletion';
import { permanentlyDeleteYtdlpCookiesFile } from '@/lib/ytdlpCookiesFile';

describe('executeYtdlp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(executeCmdToCompletion).mockResolvedValue({
      success: true,
      stdout: '{}',
      stderr: '',
      exitCode: 0,
    });
  });

  it('permanently deletes managed cookies after run when requested', async () => {
    const cookiesPath = '/data/user/temp/ytdlp-cookies-list.txt';
    await executeYtdlp(['--cookies', cookiesPath, '-J', 'https://example.com'], {
      cleanup: 'managed-cookies-after-run',
      userDataDir: '/data/user',
    });

    expect(permanentlyDeleteYtdlpCookiesFile).toHaveBeenCalledWith(cookiesPath, '/data/user');
  });

  it('does not delete cookies when cleanup is none', async () => {
    const cookiesPath = '/data/user/temp/ytdlp-cookies-job.txt';
    await executeYtdlp(['--cookies', cookiesPath, '--output', 'x', 'https://example.com'], {
      cleanup: 'none',
    });

    expect(permanentlyDeleteYtdlpCookiesFile).not.toHaveBeenCalled();
  });

  it('deletes cookies after failed command', async () => {
    vi.mocked(executeCmdToCompletion).mockResolvedValue({
      success: false,
      error: 'fail',
      stdout: '',
      stderr: 'err',
      exitCode: 1,
    });

    const cookiesPath = '/data/user/temp/ytdlp-cookies-list.txt';
    await executeYtdlp(['--cookies', cookiesPath, '-J', 'https://example.com'], {
      cleanup: 'managed-cookies-after-run',
      userDataDir: '/data/user',
    });

    expect(permanentlyDeleteYtdlpCookiesFile).toHaveBeenCalledWith(cookiesPath, '/data/user');
  });
});
