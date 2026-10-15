import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const repoRoot = join(import.meta.dir, '..');
const script = join(repoRoot, 'ci', 'docker-build-platforms.sh');

function runPlatforms(buildArm64: string): string {
  const proc = Bun.spawnSync(['bash', script], {
    cwd: repoRoot,
    env: { ...process.env, BUILD_ARM64_DOCKER_IMAGE: buildArm64 },
  });
  if (proc.exitCode !== 0) {
    throw new Error(`docker-build-platforms.sh failed (${proc.exitCode}):\n${proc.stderr.toString()}`);
  }
  return proc.stdout.toString();
}

describe('ci/docker-build-platforms.sh', () => {
  test('includes arm64 when BUILD_ARM64_DOCKER_IMAGE is true', () => {
    const out = runPlatforms('true');
    expect(out).toContain('platforms=linux/amd64,linux/arm64');
    expect(out).toContain('push_latest=true');
  });

  test('amd64 only when BUILD_ARM64_DOCKER_IMAGE is false', () => {
    const out = runPlatforms('false');
    expect(out).toContain('platforms=linux/amd64');
    expect(out).toContain('push_latest=false');
  });
});
