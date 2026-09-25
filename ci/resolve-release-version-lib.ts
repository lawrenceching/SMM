/**
 * Resolve release version / Git tag / Docker tag from package.json (or override).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ReleaseProduct = 'electron' | 'docker' | 'all';

export type ResolveReleaseVersionInput = {
  product: ReleaseProduct;
  /** Absolute paths; defaults used by CLI when omitted. */
  electronPackageJsonPath: string;
  dockerPackageJsonPath: string;
  /** Semver; leading `v` is stripped. When set, becomes the resolved version. */
  override?: string;
};

export type ResolveReleaseVersionResult = {
  version: string;
  git_tag: string;
  docker_tag: string;
};

export function stripLeadingV(raw: string): string {
  const s = raw.trim();
  if (s.length === 0) {
    throw new Error('version is empty');
  }
  return s.startsWith('v') || s.startsWith('V') ? s.slice(1) : s;
}

function readPackageVersion(packageJsonPath: string): string {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    version?: unknown;
  };
  if (typeof pkg.version !== 'string' || pkg.version.trim() === '') {
    throw new Error(`Missing or empty "version" in ${packageJsonPath}`);
  }
  return stripLeadingV(pkg.version);
}

export function resolveReleaseVersion(
  input: ResolveReleaseVersionInput,
): ResolveReleaseVersionResult {
  let version: string;

  if (input.override !== undefined && input.override.trim() !== '') {
    version = stripLeadingV(input.override);
  } else if (input.product === 'electron') {
    version = readPackageVersion(input.electronPackageJsonPath);
  } else if (input.product === 'docker') {
    version = readPackageVersion(input.dockerPackageJsonPath);
  } else {
    const electron = readPackageVersion(input.electronPackageJsonPath);
    const docker = readPackageVersion(input.dockerPackageJsonPath);
    if (electron !== docker) {
      throw new Error(
        `Version mismatch: electron=${electron} docker=${docker}. ` +
          `Bump both package.json files to the same version before releasing.`,
      );
    }
    version = electron;
  }

  return {
    version,
    git_tag: `v${version}`,
    docker_tag: version,
  };
}

export function defaultPackagePaths(repoRoot: string): {
  electronPackageJsonPath: string;
  dockerPackageJsonPath: string;
} {
  return {
    electronPackageJsonPath: join(repoRoot, 'apps', 'electron', 'package.json'),
    dockerPackageJsonPath: join(repoRoot, 'apps', 'docker', 'package.json'),
  };
}

export function formatGithubOutput(result: ResolveReleaseVersionResult): string {
  return (
    [
      `version=${result.version}`,
      `git_tag=${result.git_tag}`,
      `docker_tag=${result.docker_tag}`,
    ].join('\n') + '\n'
  );
}
