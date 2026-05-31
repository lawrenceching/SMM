/**
 * afterPack hook (macOS only): pre-sign nested binaries before electron-builder's signing pass.
 *
 * VideoCaptioner's PyInstaller bundle embeds Python.framework without the standard
 * Versions/ layout and Info.plist. codesign rejects it with "bundle format is ambiguous".
 * We sign each Mach-O inside via a temp-path copy (ActivityWatch #1250/#1254), and
 * mac.signIgnore prevents electron-builder from re-attempting the broken framework path.
 */
exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;

  const { execSync } = require('child_process');
  const { join } = require('path');
  const {
    existsSync,
    readdirSync,
    statSync,
    copyFileSync,
    unlinkSync,
    mkdtempSync,
    rmdirSync,
  } = require('fs');
  const { tmpdir } = require('os');
  const { randomBytes } = require('crypto');

  const appName = context.packager.appInfo.productFilename;
  const appDir = join(context.appOutDir, `${appName}.app`);
  const resourcesDir = join(appDir, 'Contents', 'Resources');
  if (!existsSync(resourcesDir)) return;

  const identity = process.env.CSC_NAME || process.env.APPLE_IDENTITY || process.env.APPLE_TEAM_ID;
  const identityFlag = identity ? `--sign "${identity}"` : '--sign -';

  function collectMachOFiles(dir) {
    try {
      const output = execSync(
        `find "${dir}" -type f -print0 | xargs -0 file 2>/dev/null | grep 'Mach-O' | cut -d: -f1`,
        { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
      );
      return output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function signMachOInPlace(filePath) {
    execSync(
      `codesign ${identityFlag} --force --timestamp --options runtime "${filePath}"`,
      { stdio: 'inherit', timeout: 30_000 },
    );
  }

  /** Sign a Mach-O binary outside any .framework path context. */
  function signMachOViaTempCopy(filePath) {
    const tmpDir = mkdtempSync(join(tmpdir(), 'smm-codesign-'));
    const tmpBinary = join(tmpDir, `bin-${randomBytes(4).toString('hex')}`);
    try {
      copyFileSync(filePath, tmpBinary);
      execSync(
        `codesign ${identityFlag} --force --timestamp --options runtime "${tmpBinary}"`,
        { stdio: 'inherit', timeout: 30_000 },
      );
      copyFileSync(tmpBinary, filePath);
    } finally {
      try {
        unlinkSync(tmpBinary);
      } catch {
        // ignore
      }
      try {
        rmdirSync(tmpDir);
      } catch {
        // ignore
      }
    }
  }

  function trySignFrameworkBundle(frameworkDir) {
    try {
      execSync(
        `codesign ${identityFlag} --force --timestamp --options runtime --deep "${frameworkDir}"`,
        { stdio: 'pipe', timeout: 60_000 },
      );
      console.log(`[afterPack] Signed framework bundle: ${frameworkDir}`);
      return true;
    } catch (err) {
      const msg = String(err.stderr ?? err.stdout ?? err.message ?? '');
      if (!msg.includes('bundle format is ambiguous')) {
        console.warn(`[afterPack] WARN: framework bundle sign failed for ${frameworkDir}`);
      }
      return false;
    }
  }

  function signNonStandardFramework(frameworkDir) {
    const machOs = collectMachOFiles(frameworkDir);
    if (machOs.length === 0) {
      throw new Error(`[afterPack] no Mach-O files found in ${frameworkDir}`);
    }

    for (const bin of machOs) {
      console.log(`[afterPack] Signing Mach-O via temp copy: ${bin}`);
      signMachOViaTempCopy(bin);
    }
    console.log(`[afterPack] Signed ${machOs.length} Mach-O file(s) inside ${frameworkDir}`);
  }

  function collectFrameworks(dir) {
    const results = [];
    function walk(current) {
      let entries;
      try {
        entries = readdirSync(current);
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(current, entry);
        let st;
        try {
          st = statSync(full);
        } catch {
          continue;
        }
        if (!st.isDirectory()) continue;
        if (entry.endsWith('.framework')) {
          results.push(full);
        }
        walk(full);
      }
    }
    walk(dir);
    return results;
  }

  for (const fw of collectFrameworks(resourcesDir)) {
    console.log(`[afterPack] Processing framework: ${fw}`);
    if (!trySignFrameworkBundle(fw)) {
      signNonStandardFramework(fw);
    }
  }

  const internalDir = join(resourcesDir, 'bin', 'videocaptioner', '_internal');
  if (existsSync(internalDir)) {
    for (const bin of collectMachOFiles(internalDir)) {
      if (bin.includes('.framework/')) continue;
      try {
        console.log(`[afterPack] Signing Mach-O in-place: ${bin}`);
        signMachOInPlace(bin);
      } catch {
        console.warn(`[afterPack] WARN: could not sign ${bin}`);
      }
    }
  }
};
