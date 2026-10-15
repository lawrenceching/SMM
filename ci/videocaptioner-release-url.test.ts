// ci/videocaptioner-release-url.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  normalizeVideocaptionerUpstreamVersion,
  videocaptionerArtifactVersion,
  videocaptionerReleaseAssetUrl,
  videocaptionerReleaseTag,
} from './videocaptioner-release-url';

function read3pp(): Record<string, string> {
  const pkg = JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')) as {
    '3pp': Record<string, string>;
  };
  return pkg['3pp'];
}

describe('normalizeVideocaptionerUpstreamVersion', () => {
  test('strips leading v', () => {
    expect(normalizeVideocaptionerUpstreamVersion('v1.4.2')).toBe('1.4.2');
  });

  test('strips git describe --long suffix', () => {
    expect(normalizeVideocaptionerUpstreamVersion('v1.4.2-0-g2fa280e')).toBe('1.4.2');
    expect(normalizeVideocaptionerUpstreamVersion('1.4.2-5-gabcdef0')).toBe('1.4.2');
  });

  test('strips hatch-vcs .dev suffix', () => {
    expect(normalizeVideocaptionerUpstreamVersion('1.4.2.dev3+gabc')).toBe('1.4.2');
  });
});

describe('videocaptionerArtifactVersion', () => {
  test('joins upstream and smm build', () => {
    expect(videocaptionerArtifactVersion('v1.4.2', '1.0.2')).toBe('1.4.2_1.0.2');
  });
});

describe('videocaptionerReleaseTag', () => {
  test('prefixes artifact version', () => {
    expect(videocaptionerReleaseTag('1.4.2_1.0.2')).toBe('videocaptioner-1.4.2_1.0.2');
  });
});

describe('videocaptionerReleaseAssetUrl', () => {
  test('builds SMM Releases download URL', () => {
    expect(
      videocaptionerReleaseAssetUrl({
        releasesRepo: 'lawrenceching/SMM',
        artifactVersion: '1.4.2_1.0.2',
        suffix: 'linux-x64',
      }),
    ).toBe(
      'https://github.com/lawrenceching/SMM/releases/download/videocaptioner-1.4.2_1.0.2/videocaptioner-1.4.2_1.0.2-linux-x64.tar.gz',
    );
  });
});

describe('package.json 3pp videocaptioner keys', () => {
  test('defines ref, source repo, releases repo, and split versions', () => {
    const pp = read3pp();
    expect(pp.videocaptioner_ref).toBeTruthy();
    expect(pp.videocaptioner_repo).toBe('WEIFENG2333/VideoCaptioner');
    expect(pp.videocaptioner_releases_repo).toBe('lawrenceching/SMM');
    expect(pp.videocaptioner_upstream_version).toBeTruthy();
    expect(pp.videocaptioner_smm_build_version).toBeTruthy();
    expect(pp.videocaptioner_version).toBeUndefined();
    expect(
      videocaptionerArtifactVersion(
        pp.videocaptioner_upstream_version,
        pp.videocaptioner_smm_build_version,
      ),
    ).toMatch(/^\d+\.\d+\.\d+_\d+\.\d+\.\d+$/);
  });
});

describe('consumer download URL shape', () => {
  test('download-3pp-binary.sh uses composite artifact version', () => {
    const sh = readFileSync(join(import.meta.dir, 'download-3pp-binary.sh'), 'utf8');
    expect(sh).toContain('videocaptioner_releases_repo');
    expect(sh).toContain('videocaptioner_upstream_version');
    expect(sh).toContain('videocaptioner_smm_build_version');
    expect(sh).toContain('videocaptioner-${VIDEOCAPTIONER_ARTIFACT_VERSION}');
    expect(sh).not.toContain('lawrenceching/VideoCaptioner');
    expect(sh).not.toContain("['3pp'].videocaptioner_version");
  });

  test('videocaptioner.Dockerfile uses artifact version build-arg', () => {
    const df = readFileSync(
      join(import.meta.dir, '..', 'apps/docker/videocaptioner.Dockerfile'),
      'utf8',
    );
    expect(df).toContain('VIDEOCAPTIONER_ARTIFACT_VERSION');
    expect(df).toContain('videocaptioner-${VIDEOCAPTIONER_ARTIFACT_VERSION}');
    expect(df).toMatch(/VIDEOCAPTIONER_RELEASES_REPO|videocaptioner_releases_repo/);
    expect(df).not.toContain('lawrenceching/VideoCaptioner');
  });
});
