import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { videocaptionerArtifactVersion } from './videocaptioner-release-url';

const repoRoot = join(import.meta.dir, '..');
const script = join(repoRoot, 'ci', 'docker-3pp-build-args.sh');

function runArgs(component: string): string {
  const proc = Bun.spawnSync(['bash', script, component], {
    cwd: repoRoot,
    env: { ...process.env },
  });
  if (proc.exitCode !== 0) {
    throw new Error(
      `docker-3pp-build-args.sh failed (${proc.exitCode}):\n${proc.stderr.toString()}`,
    );
  }
  return proc.stdout.toString().trim();
}

function read3pp(name: string): string {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    '3pp': Record<string, string>;
  };
  return pkg['3pp'][name]!;
}

describe('ci/docker-3pp-build-args.sh', () => {
  test('emits FFMPEG_VERSION for ffmpeg', () => {
    expect(runArgs('ffmpeg')).toBe(`--build-arg FFMPEG_VERSION=${read3pp('ffmpeg_version')}`);
  });

  test('emits YTDLP_VERSION for ytdlp', () => {
    expect(runArgs('ytdlp')).toBe(`--build-arg YTDLP_VERSION=${read3pp('ytdlp_version')}`);
  });

  test('emits videocaptioner artifact + releases repo args', () => {
    const artifact = videocaptionerArtifactVersion(
      read3pp('videocaptioner_upstream_version'),
      read3pp('videocaptioner_smm_build_version'),
    );
    const repo = read3pp('videocaptioner_releases_repo');
    const out = runArgs('videocaptioner');
    expect(out).toContain(`--build-arg VIDEOCAPTIONER_ARTIFACT_VERSION=${artifact}`);
    expect(out).toContain(`--build-arg VIDEOCAPTIONER_RELEASES_REPO=${repo}`);
  });

  test('rejects unknown component', () => {
    const proc = Bun.spawnSync(['bash', script, 'nope'], {
      cwd: repoRoot,
      env: { ...process.env },
    });
    expect(proc.exitCode).not.toBe(0);
  });
});
