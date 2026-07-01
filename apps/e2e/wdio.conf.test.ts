import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  DEFAULT_E2E_WINDOW_HEIGHT,
  DEFAULT_E2E_WINDOW_WIDTH,
  resolveE2eWindowSize,
} from './wdio.conf.ts';

describe('resolveE2eWindowSize', () => {
  const originalWidth = process.env.E2E_WINDOW_WIDTH;
  const originalHeight = process.env.E2E_WINDOW_HEIGHT;
  const originalBuildEnv = process.env.BUILD_ENV;

  beforeEach(() => {
    delete process.env.E2E_WINDOW_WIDTH;
    delete process.env.E2E_WINDOW_HEIGHT;
    delete process.env.BUILD_ENV;
  });

  afterEach(() => {
    if (originalWidth !== undefined) {
      process.env.E2E_WINDOW_WIDTH = originalWidth;
    } else {
      delete process.env.E2E_WINDOW_WIDTH;
    }
    if (originalHeight !== undefined) {
      process.env.E2E_WINDOW_HEIGHT = originalHeight;
    } else {
      delete process.env.E2E_WINDOW_HEIGHT;
    }
    if (originalBuildEnv !== undefined) {
      process.env.BUILD_ENV = originalBuildEnv;
    } else {
      delete process.env.BUILD_ENV;
    }
  });

  test('returns explicit E2E_WINDOW_WIDTH/HEIGHT when set', () => {
    process.env.E2E_WINDOW_WIDTH = '1280';
    process.env.E2E_WINDOW_HEIGHT = '720';

    expect(resolveE2eWindowSize()).toEqual({ width: 1280, height: 720 });
  });

  test('returns default 1920x1080 when BUILD_ENV=docker', () => {
    process.env.BUILD_ENV = 'docker';

    expect(resolveE2eWindowSize()).toEqual({
      width: DEFAULT_E2E_WINDOW_WIDTH,
      height: DEFAULT_E2E_WINDOW_HEIGHT,
    });
  });

  test('returns null outside docker when env size is not set', () => {
    expect(resolveE2eWindowSize()).toBeNull();
  });
});
