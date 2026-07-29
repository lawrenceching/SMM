import { describe, expect, test } from 'bun:test';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DOCKER_CONTAINER_NAME,
  DOCKER_IMAGE,
  buildDockerRunArgs,
  resolveDockerMediaHostDir,
  stopDockerE2eContainer,
  stopDockerE2eContainerSync,
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
      '--rm',
      '--name',
      DOCKER_CONTAINER_NAME,
      '-p',
      '30000:30000',
      '-p',
      '30001:30001',
      '-p',
      '30002:30002',
      '-e',
      'SMM_AUTH_TOKEN=ChangeMe123',
      '-e',
      'WEBUI_ADDRESS=0.0.0.0',
      '-e',
      'REVERSE_PROXY_ADDRESS=0.0.0.0',
      '-e',
      'MCP_ADDRESS=0.0.0.0',
      '-v',
      `${media}:/media`,
      DOCKER_IMAGE,
    ]);
  });

  test('stop helpers are exported functions', () => {
    expect(typeof stopDockerE2eContainer).toBe('function');
    expect(typeof stopDockerE2eContainerSync).toBe('function');
  });
});
