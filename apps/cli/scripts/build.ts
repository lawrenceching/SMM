import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';

// Read version from package.json
const packageJsonPath = join(import.meta.dir, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version || 'unknown';

// Generate version.ts file with the version embedded
const versionFileContent = `// This file is auto-generated at build time
// DO NOT EDIT MANUALLY
export const APP_VERSION = '${version}';
`;

const versionFilePath = join(import.meta.dir, '..', 'src', 'version.ts');
writeFileSync(versionFilePath, versionFileContent, 'utf-8');

console.log(`✓ Generated version.ts with version: ${version}`);

// CLI_COMPILE_TARGET overrides the default (e.g. bun-windows-arm64 for Win ARM64 on x64 CI).
// On Linux x64, default to baseline so packaged CLI runs on pre-AVX2 CPUs (e.g. Ivy Bridge).
function resolveDefaultCompileTarget(): string | undefined {
  if (process.platform !== 'linux') {
    return undefined;
  }
  if (process.arch === 'x64') {
    return 'bun-linux-x64-baseline';
  }
  return undefined;
}

const compileTarget =
  process.env.CLI_COMPILE_TARGET?.trim() || resolveDefaultCompileTarget();

if (compileTarget) {
  console.log(`Using compile target: ${compileTarget}`);
}

async function runBuildWithRetry(maxAttempts: number): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // NOTE: `--target` may trigger downloading bun target binaries.
      // In CI this download/extract can occasionally be incomplete, so we retry.
      const buildCmd = compileTarget
        ? $`bun build index.ts --compile --target=${compileTarget} --outfile dist/cli`
        : $`bun build index.ts --compile --outfile dist/cli`;

      const result = await buildCmd.quiet();
      if (result.exitCode !== 0) {
        throw new Error(`bun build failed with exit code ${result.exitCode}`);
      }

      console.log('✓ Build completed successfully');
      return;
    } catch (err) {
      lastError = err;
      console.warn(`[cli build] attempt ${attempt}/${maxAttempts} failed`);

      if (attempt < maxAttempts) {
        // incremental backoff; helps when CI network/filesystem is briefly flaky
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
        continue;
      }
    }
  }

  // If we got here, all attempts failed
  throw lastError;
}

await runBuildWithRetry(3);

