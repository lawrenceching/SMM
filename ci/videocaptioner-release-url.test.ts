// ci/videocaptioner-release-url.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  videocaptionerReleaseAssetUrl,
  videocaptionerReleaseTag,
} from './videocaptioner-release-url';

function read3pp(): Record<string, string> {
  const pkg = JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')) as {
    '3pp': Record<string, string>;
  };
  return pkg['3pp'];
}

describe('videocaptionerReleaseTag', () => {
  test('prefixes version', () => {
    expect(videocaptionerReleaseTag('1.0.1')).toBe('videocaptioner-1.0.1');
  });
});

describe('videocaptionerReleaseAssetUrl', () => {
  test('builds SMM Releases download URL', () => {
    expect(
      videocaptionerReleaseAssetUrl({
        releasesRepo: 'lawrenceching/SMM',
        version: '1.0.1',
        suffix: 'linux-x64',
      }),
    ).toBe(
      'https://github.com/lawrenceching/SMM/releases/download/videocaptioner-1.0.1/videocaptioner-1.0.1-linux-x64.tar.gz',
    );
  });
});

describe('package.json 3pp videocaptioner keys', () => {
  test('defines ref, source repo, and releases repo', () => {
    const pp = read3pp();
    expect(pp.videocaptioner_ref).toBeTruthy();
    expect(pp.videocaptioner_repo).toMatch(/^[^/]+\/[^/]+$/);
    expect(pp.videocaptioner_releases_repo).toBe('lawrenceching/SMM');
    expect(pp.videocaptioner_version).toBeTruthy();
  });
});

describe('consumer download URL shape', () => {
  test('download-3pp-binary.sh uses videocaptioner- tag prefix and releases_repo', () => {
    const sh = readFileSync(join(import.meta.dir, 'download-3pp-binary.sh'), 'utf8');
    expect(sh).toContain('videocaptioner_releases_repo');
    expect(sh).toContain('videocaptioner-${VIDEOCAPTIONER_VERSION}');
    expect(sh).not.toContain('lawrenceching/VideoCaptioner');
  });

  test('videocaptioner.Dockerfile uses videocaptioner- tag prefix', () => {
    const df = readFileSync(
      join(import.meta.dir, '..', 'apps/docker/videocaptioner.Dockerfile'),
      'utf8',
    );
    expect(df).toContain('videocaptioner-${VIDEOCAPTIONER_VERSION}');
    expect(df).toMatch(/VIDEOCAPTIONER_RELEASES_REPO|videocaptioner_releases_repo/);
    expect(df).not.toContain('lawrenceching/VideoCaptioner');
  });
});
