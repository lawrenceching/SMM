import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dir, '..');
const script = join(repoRoot, 'ci', 'docker-image-coords.sh');

const OWNER = 'smm-owner';
const SHA = 'abc123';

function runCoords(env: Record<string, string> = {}): string {
  const proc = Bun.spawnSync(['bash', script], {
    cwd: repoRoot,
    env: { ...process.env, OWNER_LC: OWNER, SHA, ...env },
  });
  if (proc.exitCode !== 0) {
    throw new Error(`docker-image-coords.sh failed (${proc.exitCode}):\n${proc.stderr.toString()}`);
  }
  return proc.stdout.toString();
}

function read3ppVersion(name: string): string {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  return pkg['3pp'][name];
}

describe('ci/docker-image-coords.sh', () => {
  test('emits owner and sha', () => {
    const out = runCoords();
    expect(out).toContain(`owner_lc=${OWNER}`);
    expect(out).toContain(`sha=${SHA}`);
  });

  test('emits cli and ui images keyed by SHA', () => {
    const out = runCoords();
    expect(out).toContain(`cli_image=ghcr.io/${OWNER}/smm-cli-build:${SHA}`);
    expect(out).toContain(`ui_image=ghcr.io/${OWNER}/smm-ui-build:${SHA}`);
  });

  test('emits 3pp images keyed by package.json versions', () => {
    const out = runCoords();
    expect(out).toContain(`ffmpeg_image=ghcr.io/${OWNER}/smm-ffmpeg:${read3ppVersion('ffmpeg_version')}`);
    expect(out).toContain(`ytdlp_image=ghcr.io/${OWNER}/smm-ytdlp:${read3ppVersion('ytdlp_version')}`);
    expect(out).toContain(
      `videocaptioner_image=ghcr.io/${OWNER}/smm-videocaptioner:${read3ppVersion('videocaptioner_version')}`,
    );
  });

  test('emits raw 3pp versions from package.json', () => {
    const out = runCoords();
    expect(out).toContain(`ffmpeg_version=${read3ppVersion('ffmpeg_version')}`);
    expect(out).toContain(`ytdlp_version=${read3ppVersion('ytdlp_version')}`);
    expect(out).toContain(`videocaptioner_version=${read3ppVersion('videocaptioner_version')}`);
  });

  test('lowercases OWNER_LC', () => {
    const out = runCoords({ OWNER_LC: 'Smm-Owner' });
    expect(out).toContain('owner_lc=smm-owner');
    expect(out).toContain('cli_image=ghcr.io/smm-owner/smm-cli-build:abc123');
  });

  test('is deterministic for the same input', () => {
    expect(runCoords()).toBe(runCoords());
  });

  test('requires OWNER_LC and SHA', () => {
    const proc = Bun.spawnSync(['bash', script], {
      cwd: repoRoot,
      env: { ...process.env },
    });
    expect(proc.exitCode).toBe(1);
    expect(proc.stderr.toString()).toContain('OWNER_LC');
  });
});
