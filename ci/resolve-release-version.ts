/**
 * Resolve release version for CI (KEY=VALUE for GITHUB_OUTPUT).
 *
 * Usage:
 *   bun ci/resolve-release-version.ts --product electron|docker|all [--override 1.2.3]
 */
import { join } from 'node:path';
import {
  defaultPackagePaths,
  formatGithubOutput,
  resolveReleaseVersion,
  type ReleaseProduct,
} from './resolve-release-version-lib';

function printUsage(): void {
  console.error(
    'Usage: bun ci/resolve-release-version.ts --product electron|docker|all [--override <semver>]',
  );
}

function parseArgs(argv: string[]):
  | { product: ReleaseProduct; override: string | undefined }
  | 'usage' {
  let product: ReleaseProduct | undefined;
  let override: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--product') {
      const next = argv[++i];
      if (next !== 'electron' && next !== 'docker' && next !== 'all') {
        return 'usage';
      }
      product = next;
      continue;
    }
    if (a === '--override') {
      const next = argv[++i];
      if (!next) return 'usage';
      override = next;
      continue;
    }
    return 'usage';
  }

  if (!product) return 'usage';
  return { product, override };
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'usage') {
    printUsage();
    return 2;
  }

  const repoRoot = join(import.meta.dir, '..');
  const paths = defaultPackagePaths(repoRoot);

  try {
    const result = resolveReleaseVersion({
      product: parsed.product,
      ...paths,
      override: parsed.override,
    });
    console.log(formatGithubOutput(result));
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

process.exit(main());
