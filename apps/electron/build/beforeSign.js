/**
 * Pre-sign nested frameworks before the main macOS code signing pass.
 *
 * electron-builder calls this after the app is assembled but before it
 * runs `codesign` on the top-level .app bundle. Frameworks bundled inside
 * extraResources (e.g. VideoCaptioner's Python.framework) often lack
 * standard framework metadata (Info.plist, Versions/ layout), causing
 * `codesign --deep` to fail with "bundle format is ambiguous".
 *
 * We walk every *.framework directory and stamp it individually so the
 * main signing pass sees properly signed sub-bundles.
 */
exports.default = async function (context) {
  // macOS only
  if (context.packager.platform.name !== 'mac') return

  const { execSync } = require('child_process');
  const { join } = require('path');
  const { existsSync, readdirSync, statSync } = require('fs');

  const appName = context.packager.appInfo.productFilename;
  const appDir = join(context.appOutDir, `${appName}.app`);
  const resourcesDir = join(appDir, 'Contents', 'Resources');

  if (!existsSync(resourcesDir)) return;

  // Use signing identity from env, or ad-hoc if not available
  const identityFlag = process.env.APPLE_TEAM_ID
    ? `--sign "${process.env.APPLE_TEAM_ID}"`
    : '--sign -';

  /** Collect all .framework directories recursively. */
  function collectFrameworks(dir) {
    const results = [];
    try {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (entry.endsWith('.framework') && statSync(full).isDirectory()) {
          results.push(full);
        } else if (statSync(full).isDirectory()) {
          results.push(...collectFrameworks(full));
        }
      }
    } catch {
      // permission / symlink issues
    }
    return results;
  }

  const frameworks = collectFrameworks(resourcesDir);

  for (const fw of frameworks) {
    console.log(`[beforeSign] Pre-signing framework: ${fw}`);
    try {
      execSync(
        `codesign ${identityFlag} --force --timestamp --options runtime --deep "${fw}"`,
        { stdio: 'inherit', timeout: 30_000 },
      );
      console.log(`[beforeSign] OK: ${fw}`);
    } catch (err) {
      // Log but don't block — the main pass may still handle it
      console.warn(`[beforeSign] WARN: could not sign ${fw}`);
    }
  }

  // Pre-sign any bare (extension-less) Mach-O binaries inside _internal
  // that might confuse codesign's bundle format detection.
  const internalDir = join(resourcesDir, 'bin', 'videocaptioner', '_internal');
  if (existsSync(internalDir)) {
    try {
      for (const entry of readdirSync(internalDir)) {
        const full = join(internalDir, entry);
        if (statSync(full).isFile() && !entry.includes('.')) {
          try {
            execSync(
              `codesign ${identityFlag} --force --timestamp --options runtime "${full}"`,
              { stdio: 'inherit', timeout: 15_000 },
            );
          } catch {
            // skip non-Mach-O files
          }
        }
      }
    } catch {
      // ignore
    }
  }
};
