import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { stripBgutilPackaging, targetOmitsBgutilServer } from '../apps/electron/scripts/run-electron-builder.mjs';

const repoRoot = join(import.meta.dir, '..');

function read3pp(): Record<string, string> {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    '3pp': Record<string, string>;
  };
  return pkg['3pp'];
}

describe('bgutil packaging contract', () => {
  test('package.json pins bgutil and node versions', () => {
    const pp = read3pp();
    expect(pp.bgutil_version).toBe('2.0.2');
    expect(pp.node_version).toBe('22.22.0');
  });

  test('download-3pp-binary.sh installs the plugin zip, node, and built server', () => {
    const sh = readFileSync(join(repoRoot, 'ci', 'download-3pp-binary.sh'), 'utf8');
    expect(sh).toContain("['3pp'].bgutil_version");
    expect(sh).toContain("['3pp'].node_version");
    expect(sh).toContain('https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIST}.${NODE_ARCHIVE_EXT}');
    expect(sh).toContain('https://github.com/Brainicism/bgutil-ytdlp-pot-provider');
    expect(sh).toContain('releases/download/${BGUTIL_VERSION}/bgutil-ytdlp-pot-provider.zip');
    expect(sh).toContain('bin/yt-dlp/yt-dlp-plugins/bgutil-ytdlp-pot-provider.zip');
    expect(sh).toContain('bin/bgutil-pot-provider');
    expect(sh).toContain('build/main.js');
    expect(sh).toContain('prune --omit=dev');
    expect(sh).toContain('Skipping bgutil POT server and Node runtime on arm64.');
  });

  test('bgutil.Dockerfile uses the same release zip and node dist', () => {
    const df = readFileSync(join(repoRoot, 'apps/docker/bgutil.Dockerfile'), 'utf8');
    expect(df).toContain('ARG BGUTIL_VERSION=2.0.2');
    expect(df).toContain('ARG NODE_VERSION=22.22.0');
    expect(df).toContain('https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIST}.tar.xz');
    expect(df).toContain(
      'https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/${BGUTIL_VERSION}/bgutil-ytdlp-pot-provider.zip',
    );
    expect(df).toContain('/output/bin/bgutil-pot-provider');
    expect(df).toContain('prune --omit=dev');
    expect(df).toContain('Skipping bgutil POT server and Node runtime on arm64.');
    expect(df).toContain('if [ "${TARGETARCH}" = "arm64" ]');
  });

  test('arm64 electron packaging drops the POT server and keeps the plugin zip', () => {
    const yml = readFileSync(join(repoRoot, 'apps/electron/electron-builder.yml'), 'utf8');
    const stripped = stripBgutilPackaging(yml);
    expect(yml.match(/# bgutil-packaging:begin/g)?.length).toBe(3);
    expect(stripped).not.toContain('bin/bgutil-pot-provider');
    expect(stripped).not.toContain("from: '../../bin/node'");
    expect(stripped).toContain('yt-dlp-plugins');
    expect(targetOmitsBgutilServer(['--win', '--arm64'], {}, 'x64')).toBe(true);
    expect(targetOmitsBgutilServer(['--win', '--x64'], { ARCH: 'arm64' }, 'arm64')).toBe(false);
    expect(targetOmitsBgutilServer(['--mac'], {}, 'arm64')).toBe(true);
    expect(targetOmitsBgutilServer(['--win'], { ARCH: 'x64' }, 'arm64')).toBe(false);
  });
});
