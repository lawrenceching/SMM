/**
 * Helpers for comparing / bumping root package.json `3pp.ytdlp_version`
 * against the official yt-dlp GitHub release tag.
 */

export function readPinnedYtdlpVersion(packageJsonText: string): string {
  const pkg = JSON.parse(packageJsonText) as { '3pp'?: { ytdlp_version?: string } };
  const version = pkg['3pp']?.ytdlp_version?.trim();
  if (!version) {
    throw new Error('package.json missing 3pp.ytdlp_version');
  }
  return version;
}

export function normalizeYtdlpReleaseTag(tag: string): string {
  const t = tag.trim();
  if (!t) {
    throw new Error('yt-dlp release tag is empty');
  }
  return t.replace(/^v/i, '');
}

export function ytdlpNeedsBump(pinned: string, latestTag: string): boolean {
  return normalizeYtdlpReleaseTag(pinned) !== normalizeYtdlpReleaseTag(latestTag);
}

/** Returns package.json text with only `3pp.ytdlp_version` updated (minimal diff). */
export function setPinnedYtdlpVersion(packageJsonText: string, version: string): string {
  const next = normalizeYtdlpReleaseTag(version);
  readPinnedYtdlpVersion(packageJsonText);
  const replaced = packageJsonText.replace(
    /("ytdlp_version"\s*:\s*")([^"]*)(")/,
    `$1${next}$3`,
  );
  if (readPinnedYtdlpVersion(replaced) !== next) {
    throw new Error('failed to replace 3pp.ytdlp_version in package.json');
  }
  return replaced;
}
