// This file is auto-generated at build time by scripts/build.ts
// DO NOT EDIT MANUALLY - it will be overwritten during build
// For development (when running with bun run), it falls back to reading package.json
export const APP_VERSION = (() => {
  // In compiled binary, this will be replaced with the actual version string
  // For development, read from package.json
  try {
    if (typeof import.meta.dir !== 'undefined') {
      const { readFileSync } = require('fs');
      const { join } = require('path');
      const packageJsonPath = join(import.meta.dir, '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.version || 'unknown';
    }
  } catch {
    // Ignore errors
  }
  return 'unknown';
})();

