/**
 * Removes broken WebdriverIO browser cache directories.
 *
 * When a wdio process is interrupted mid-download, wdio-cache may contain
 * version folders without the actual chrome/chromedriver binary. Subsequent
 * runs fail with "folder exists but executable is missing".
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const PINNED_CHROME_VERSION = '146.0.7680.153';

type BrowserCacheTarget = {
  kind: 'chrome' | 'chromedriver';
  relativeExecutable: string;
};

function platformCacheId(): string {
  if (process.platform === 'win32') {
    return `win64-${PINNED_CHROME_VERSION}`;
  }
  if (process.platform === 'darwin') {
    return `mac-arm64-${PINNED_CHROME_VERSION}`;
  }
  return `linux-${PINNED_CHROME_VERSION}`;
}

function cacheTargets(): BrowserCacheTarget[] {
  if (process.platform === 'win32') {
    return [
      {
        kind: 'chrome',
        relativeExecutable: path.join('chrome-win64', 'chrome.exe'),
      },
      {
        kind: 'chromedriver',
        relativeExecutable: path.join('chromedriver-win64', 'chromedriver.exe'),
      },
    ];
  }

  if (process.platform === 'darwin') {
    return [
      {
        kind: 'chrome',
        relativeExecutable: path.join(
          'chrome-mac-arm64',
          'Google Chrome for Testing.app',
          'Contents',
          'MacOS',
          'Google Chrome for Testing',
        ),
      },
      {
        kind: 'chromedriver',
        relativeExecutable: path.join('chromedriver-mac-arm64', 'chromedriver'),
      },
    ];
  }

  return [
    {
      kind: 'chrome',
      relativeExecutable: path.join('chrome-linux64', 'chrome'),
    },
    {
      kind: 'chromedriver',
      relativeExecutable: path.join('chromedriver-linux64', 'chromedriver'),
    },
  ];
}

export function repairWdioBrowserCache(
  cacheDir = path.join(os.homedir(), 'wdio-cache'),
): string[] {
  const removed: string[] = [];
  const platformId = platformCacheId();

  for (const target of cacheTargets()) {
    const versionDir = path.join(cacheDir, target.kind, platformId);
    if (!fs.existsSync(versionDir)) {
      continue;
    }

    const executablePath = path.join(versionDir, target.relativeExecutable);
    if (fs.existsSync(executablePath)) {
      continue;
    }

    fs.rmSync(versionDir, { recursive: true, force: true });
    removed.push(versionDir);
  }

  return removed;
}

function main(): void {
  const removed = repairWdioBrowserCache();
  if (removed.length > 0) {
    console.log('[ensure-wdio-cache] removed broken cache dirs:');
    for (const dir of removed) {
      console.log(`  - ${dir}`);
    }
  }
}

if (import.meta.main) {
  main();
}
