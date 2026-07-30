import { describe, expect, test } from 'bun:test';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DOCKER_COMPOSE_FILE,
  DOCKER_COMPOSE_PROJECT,
  DOCKER_CONTAINER_NAME,
  buildDockerComposeEnv,
  buildDockerComposeUpArgs,
  resolveDockerMediaHostDir,
  stopDockerE2eContainer,
  stopDockerE2eContainerSync,
} from './e2e-docker-container.ts';

describe('e2e-docker-container helpers', () => {
  test('resolveDockerMediaHostDir is os.tmpdir()/smm', () => {
    expect(resolveDockerMediaHostDir()).toBe(path.join(os.tmpdir(), 'smm'));
  });

  test('buildDockerComposeUpArgs uses compose file and project', () => {
    const media = path.join(os.tmpdir(), 'smm');
    const args = buildDockerComposeUpArgs({
      authToken: 'ChangeMe123',
      mediaHostDir: media,
    });
    expect(args).toEqual([
      'compose',
      '-f',
      DOCKER_COMPOSE_FILE,
      '-p',
      DOCKER_COMPOSE_PROJECT,
      'up',
      '--build',
      '--abort-on-container-exit',
      '--exit-code-from',
      'smm',
    ]);
    expect(DOCKER_COMPOSE_FILE.replace(/\\/g, '/')).toMatch(
      /apps\/e2e\/docker\/docker-compose\.yml$/,
    );
  });

  test('buildDockerComposeEnv sets auth and media host dir', () => {
    const media = path.join(os.tmpdir(), 'smm');
    const env = buildDockerComposeEnv({
      authToken: 'tok',
      mediaHostDir: media,
    });
    expect(env.SMM_AUTH_TOKEN).toBe('tok');
    expect(env.SMM_E2E_MEDIA_HOST_DIR).toBe(media);
  });

  test('DOCKER_CONTAINER_NAME remains smm for docker exec helpers', () => {
    expect(DOCKER_CONTAINER_NAME).toBe('smm');
  });

  test('stop helpers are exported functions', () => {
    expect(typeof stopDockerE2eContainer).toBe('function');
    expect(typeof stopDockerE2eContainerSync).toBe('function');
  });
});
