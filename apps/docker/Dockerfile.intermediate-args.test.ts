import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dockerfile = readFileSync(join(import.meta.dir, 'Dockerfile'), 'utf8');

const requiredArgs: Array<{ arg: string; defaultImage: string; stage: string }> = [
  { arg: 'SMM_CLI_IMAGE', defaultImage: 'smm-cli-build:latest', stage: 'cli' },
  { arg: 'SMM_UI_IMAGE', defaultImage: 'smm-ui-build:latest', stage: 'ui' },
  { arg: 'SMM_FFMPEG_IMAGE', defaultImage: 'smm-ffmpeg:latest', stage: 'ffmpeg' },
  { arg: 'SMM_YTDLP_IMAGE', defaultImage: 'smm-ytdlp:latest', stage: 'ytdlp' },
  {
    arg: 'SMM_VIDEOCAPTIONER_IMAGE',
    defaultImage: 'smm-videocaptioner:latest',
    stage: 'videocaptioner',
  },
];

describe('apps/docker/Dockerfile intermediate image args', () => {
  for (const { arg, defaultImage, stage } of requiredArgs) {
    test(`declares ARG ${arg}=${defaultImage} and FROM \${${arg}} AS ${stage}`, () => {
      expect(dockerfile).toContain(`ARG ${arg}=${defaultImage}`);
      expect(dockerfile).toContain(`FROM \${${arg}} AS ${stage}`);
    });
  }
});
