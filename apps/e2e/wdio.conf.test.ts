import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  DEFAULT_E2E_WINDOW_HEIGHT,
  DEFAULT_E2E_WINDOW_WIDTH,
  fitE2eWindowSizeToScreen,
  resolveAppliedE2eWindowSize,
  resolveE2eWindowSize,
  shouldFitE2eWindowToScreen,
} from './wdio.conf.ts';

describe('fitE2eWindowSizeToScreen', () => {
  test('clamps 1920x1080 to 4K@200% work area so window fits logical screen', () => {
    // 4K physical (3840x2160) at 200% scaling → logical ~1920x1080; taskbar shrinks availHeight.
    expect(
      fitE2eWindowSizeToScreen(
        { width: 1920, height: 1080 },
        { availWidth: 1920, availHeight: 1040 },
      ),
    ).toEqual({ width: 1920, height: 1040 });
  });

  test('keeps target when it already fits the work area', () => {
    expect(
      fitE2eWindowSizeToScreen(
        { width: 1920, height: 1080 },
        { availWidth: 3840, availHeight: 2160 },
      ),
    ).toEqual({ width: 1920, height: 1080 });
  });
});

describe('shouldFitE2eWindowToScreen', () => {
  const originalBuildEnv = process.env.BUILD_ENV;

  beforeEach(() => {
    delete process.env.BUILD_ENV;
  });

  afterEach(() => {
    if (originalBuildEnv !== undefined) {
      process.env.BUILD_ENV = originalBuildEnv;
    } else {
      delete process.env.BUILD_ENV;
    }
  });

  test('skips screen fit in CI/docker headless so 800x600 virtual screen cannot clamp target', () => {
    process.env.BUILD_ENV = 'docker';
    expect(shouldFitE2eWindowToScreen()).toBe(false);
  });

  test('fits to screen locally (headed high-DPI)', () => {
    expect(shouldFitE2eWindowToScreen()).toBe(true);
  });
});

describe('resolveAppliedE2eWindowSize', () => {
  test('returns target unchanged when fitToScreen is false (CI headless)', () => {
    expect(
      resolveAppliedE2eWindowSize(
        { width: 1920, height: 1080 },
        { availWidth: 800, availHeight: 600 },
        { fitToScreen: false },
      ),
    ).toEqual({ width: 1920, height: 1080 });
  });

  test('clamps to screen when fitToScreen is true', () => {
    expect(
      resolveAppliedE2eWindowSize(
        { width: 1920, height: 1080 },
        { availWidth: 1920, availHeight: 1040 },
        { fitToScreen: true },
      ),
    ).toEqual({ width: 1920, height: 1040 });
  });
});

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

  test('returns default 1920x1080 when env size is not set', () => {
    expect(resolveE2eWindowSize()).toEqual({
      width: DEFAULT_E2E_WINDOW_WIDTH,
      height: DEFAULT_E2E_WINDOW_HEIGHT,
    });
  });
});
