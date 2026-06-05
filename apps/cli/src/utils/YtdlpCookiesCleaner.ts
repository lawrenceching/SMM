import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { isManagedYtdlpCookiesBasename } from '@core/whitelistedCmd/ytdlpCookies';
import { logger } from '../../lib/logger';
import { permanentlyDeleteFile } from './files';

export interface YtdlpCookiesCleanerOptions {
  userDataDir: string;
}

export interface YtdlpCookiesCleanResult {
  removed: number;
  failed: number;
  remaining: number;
}

/**
 * Removes SMM-managed yt-dlp cookie temp files under `{userDataDir}/temp/`.
 */
export class YtdlpCookiesCleaner {
  private readonly tempDir: string;

  constructor(options: YtdlpCookiesCleanerOptions) {
    this.tempDir = path.resolve(options.userDataDir, 'temp');
  }

  async cleanAll(): Promise<YtdlpCookiesCleanResult> {
    let entries: string[];
    try {
      entries = await readdir(this.tempDir);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        logger.info(
          { tempDir: this.tempDir },
          '[YtdlpCookiesCleaner] temp dir does not exist, nothing to clean',
        );
        return { removed: 0, failed: 0, remaining: 0 };
      }
      logger.warn(
        { err, tempDir: this.tempDir },
        '[YtdlpCookiesCleaner] failed to read temp dir',
      );
      return { removed: 0, failed: 0, remaining: 0 };
    }

    let removed = 0;
    let failed = 0;
    const managedPaths: string[] = [];

    for (const name of entries) {
      if (!isManagedYtdlpCookiesBasename(name)) {
        continue;
      }

      const fullPath = path.join(this.tempDir, name);
      try {
        const fileStats = await stat(fullPath);
        if (!fileStats.isFile()) {
          continue;
        }
        managedPaths.push(fullPath);
      } catch (err) {
        logger.warn(
          { err, filePath: fullPath },
          '[YtdlpCookiesCleaner] failed to stat managed cookies file, skipping',
        );
        failed++;
      }
    }

    for (const fullPath of managedPaths) {
      try {
        await permanentlyDeleteFile(fullPath);
        removed++;
      } catch (err) {
        logger.warn(
          { err, filePath: fullPath },
          '[YtdlpCookiesCleaner] failed to delete managed cookies file',
        );
        failed++;
      }
    }

    const remaining = managedPaths.length - removed;

    logger.info(
      { removed, failed, remaining, tempDir: this.tempDir },
      '[YtdlpCookiesCleaner] cleanup completed',
    );

    return { removed, failed, remaining };
  }
}
