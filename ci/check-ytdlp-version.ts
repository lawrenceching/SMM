#!/usr/bin/env bun
/**
 * Compare pinned 3pp.ytdlp_version with yt-dlp latest GitHub release.
 *
 * Usage:
 *   bun ci/check-ytdlp-version.ts              # exit 0 always; prints KEY=VALUE
 *   bun ci/check-ytdlp-version.ts --bump       # rewrite package.json when outdated
 *
 * Env:
 *   YTDLP_LATEST_TAG  optional override (skip GitHub API), for tests
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  normalizeYtdlpReleaseTag,
  readPinnedYtdlpVersion,
  setPinnedYtdlpVersion,
  ytdlpNeedsBump,
} from './check-ytdlp-version-lib';

const repoRoot = join(import.meta.dir, '..');
const packageJsonPath = join(repoRoot, 'package.json');
const bump = process.argv.includes('--bump');

async function fetchLatestTag(): Promise<string> {
  if (process.env.YTDLP_LATEST_TAG) {
    return process.env.YTDLP_LATEST_TAG;
  }
  const url = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'smm-check-ytdlp-version',
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    throw new Error(`GitHub API ${resp.status}: ${await resp.text()}`);
  }
  const body = (await resp.json()) as { tag_name?: string };
  if (!body.tag_name) {
    throw new Error('GitHub API response missing tag_name');
  }
  return body.tag_name;
}

const pkgText = readFileSync(packageJsonPath, 'utf8');
const pinned = readPinnedYtdlpVersion(pkgText);
const latestRaw = await fetchLatestTag();
const latest = normalizeYtdlpReleaseTag(latestRaw);
const needsBump = ytdlpNeedsBump(pinned, latest);

if (bump && needsBump) {
  writeFileSync(packageJsonPath, setPinnedYtdlpVersion(pkgText, latest), 'utf8');
}

const lines = [
  `pinned=${pinned}`,
  `latest=${latest}`,
  `needs_bump=${needsBump ? 'true' : 'false'}`,
  // yt-dlp release tags are date-only (no leading v).
  `release_url=https://github.com/yt-dlp/yt-dlp/releases/tag/${latest}`,
];

for (const line of lines) {
  console.log(line);
}

if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`, { flag: 'a' });
}
