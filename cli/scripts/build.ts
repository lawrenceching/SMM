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

// Now run the actual build
const buildResult = await $`bun build index.ts --compile --outfile dist/cli`.quiet();
if (buildResult.exitCode !== 0) {
  console.error('Build failed');
  process.exit(1);
}
console.log('✓ Build completed successfully');

