import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  formatGithubOutput,
  resolveReleaseVersion,
  stripLeadingV,
} from './resolve-release-version-lib';

function writePkg(dir: string, version: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'package.json');
  writeFileSync(path, JSON.stringify({ name: 't', version }), 'utf8');
  return path;
}

describe('stripLeadingV', () => {
  test('strips leading v', () => {
    expect(stripLeadingV('v1.2.3')).toBe('1.2.3');
    expect(stripLeadingV('V1.2.3')).toBe('1.2.3');
  });

  test('leaves bare semver', () => {
    expect(stripLeadingV('1.2.3')).toBe('1.2.3');
  });
});

describe('resolveReleaseVersion', () => {
  test('electron product reads electron package.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'rrv-'));
    try {
      const electron = writePkg(join(root, 'electron'), '1.4.14');
      const docker = writePkg(join(root, 'docker'), '9.9.9');
      const r = resolveReleaseVersion({
        product: 'electron',
        electronPackageJsonPath: electron,
        dockerPackageJsonPath: docker,
      });
      expect(r).toEqual({
        version: '1.4.14',
        git_tag: 'v1.4.14',
        docker_tag: '1.4.14',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('docker product reads docker package.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'rrv-'));
    try {
      const electron = writePkg(join(root, 'electron'), '9.9.9');
      const docker = writePkg(join(root, 'docker'), '1.4.14');
      const r = resolveReleaseVersion({
        product: 'docker',
        electronPackageJsonPath: electron,
        dockerPackageJsonPath: docker,
      });
      expect(r.docker_tag).toBe('1.4.14');
      expect(r.git_tag).toBe('v1.4.14');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('all product requires matching versions', () => {
    const root = mkdtempSync(join(tmpdir(), 'rrv-'));
    try {
      const electron = writePkg(join(root, 'electron'), '1.4.14');
      const docker = writePkg(join(root, 'docker'), '1.4.14');
      const r = resolveReleaseVersion({
        product: 'all',
        electronPackageJsonPath: electron,
        dockerPackageJsonPath: docker,
      });
      expect(r.version).toBe('1.4.14');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('all product fails on mismatch', () => {
    const root = mkdtempSync(join(tmpdir(), 'rrv-'));
    try {
      const electron = writePkg(join(root, 'electron'), '1.4.14');
      const docker = writePkg(join(root, 'docker'), '1.4.15');
      expect(() =>
        resolveReleaseVersion({
          product: 'all',
          electronPackageJsonPath: electron,
          dockerPackageJsonPath: docker,
        }),
      ).toThrow(/Version mismatch/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('override wins and strips v', () => {
    const root = mkdtempSync(join(tmpdir(), 'rrv-'));
    try {
      const electron = writePkg(join(root, 'electron'), '0.0.1');
      const docker = writePkg(join(root, 'docker'), '0.0.2');
      const r = resolveReleaseVersion({
        product: 'all',
        electronPackageJsonPath: electron,
        dockerPackageJsonPath: docker,
        override: 'v2.0.0',
      });
      expect(r).toEqual({
        version: '2.0.0',
        git_tag: 'v2.0.0',
        docker_tag: '2.0.0',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('formatGithubOutput', () => {
    expect(
      formatGithubOutput({
        version: '1.4.14',
        git_tag: 'v1.4.14',
        docker_tag: '1.4.14',
      }),
    ).toBe('version=1.4.14\ngit_tag=v1.4.14\ndocker_tag=1.4.14\n');
  });
});
