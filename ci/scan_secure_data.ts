/**
 * Scan e2e cicd artifacts for leaked secret env values.
 *
 * Usage (repo root):
 *   bun ci/scan_secure_data.ts [--dir artifacts/cicd]
 *
 * Exit: 0 = clean / nothing to scan; 1 = leak found; 2 = usage/error
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  collectSecretsFromEnv,
  redactSecret,
  scanDirectoryForSecrets,
} from './scan-secure-data-lib';

function printUsage(): void {
  console.error('Usage: bun ci/scan_secure_data.ts [--dir <path>]');
}

function parseArgs(argv: string[]): { dir: string } | 'usage' {
  let dir = 'artifacts/cicd';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--dir') {
      const next = argv[++i];
      if (!next) return 'usage';
      dir = next;
      continue;
    }
    if (a === '--help' || a === '-h') return 'usage';
    return 'usage';
  }
  return { dir };
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'usage') {
    printUsage();
    return 2;
  }
  const root = path.resolve(process.cwd(), parsed.dir);
  const secrets = collectSecretsFromEnv(process.env);
  if (secrets.length === 0) {
    console.log('[scan_secure_data] no non-empty secure env values to scan; skip');
    return 0;
  }
  if (!fs.existsSync(root)) {
    console.log(`[scan_secure_data] directory missing: ${root}; skip`);
    return 0;
  }
  const hits = scanDirectoryForSecrets(root, secrets);
  if (hits.length === 0) {
    console.log(
      `[scan_secure_data] ok: scanned ${root} against ${secrets.length} secret(s); no leaks`,
    );
    return 0;
  }
  console.error(
    `[scan_secure_data] FAIL: ${hits.length} potential secret leak(s) in ${root}`,
  );
  for (const hit of hits) {
    const sample = secrets.find((s) => s.name === hit.envName)?.value ?? '';
    console.error(
      `  - ${hit.envName} (${redactSecret(sample)}) in ${hit.relativePath}:${hit.lineNumber}`,
    );
  }
  return 1;
}

process.exit(main());
