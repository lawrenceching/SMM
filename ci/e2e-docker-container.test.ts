import { describe, expect, test } from 'bun:test';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DOCKER_CONTAINER_NAME,
  DOCKER_IMAGE,
  buildDockerRunArgs,
  resolveDockerMediaHostDir,
} from './e2e-docker-container.ts';

describe('e2e-docker-container helpers', () => {
  test('resolveDockerMediaHostDir is os.tmpdir()/smm', () => {
    expect(resolveDockerMediaHostDir()).toBe(path.join(os.tmpdir(), 'smm'));
  });

  test('buildDockerRunArgs matches required docker run shape', () => {
    const media = path.join(os.tmpdir(), 'smm');
    const args = buildDockerRunArgs({
      authToken: 'ChangeMe123',
      mediaHostDir: media,
    });
    expect(args).toEqual([
      'run',
      '-d',
      '--rm',
      '--name',
      DOCKER_CONTAINER_NAME,
      '-p',
      '30000:30000',
      '-p',
      '30002:30002',
      '-e',
      'SMM_AUTH_TOKEN=ChangeMe123',
      '-v',
      `${media}:/media`,
      DOCKER_IMAGE,
    ]);
  });
});
