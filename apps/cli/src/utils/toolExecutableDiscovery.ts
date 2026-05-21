import fs from "fs";
import path from "path";
import os from "os";

export function getCliProjectRoot(): string {
  return path.resolve(__dirname, "../../../../");
}

export function getSmmDataDir(): string {
  const platform = os.platform();
  const homedir = os.homedir();

  switch (platform) {
    case "win32":
      return process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "SMM")
        : path.join(homedir, "AppData", "Local", "SMM");
    case "darwin":
      return path.join(homedir, "Library", "Application Support", "SMM");
    case "linux":
      return process.env.XDG_DATA_HOME
        ? path.join(process.env.XDG_DATA_HOME, "SMM")
        : path.join(homedir, ".local", "share", "SMM");
    default:
      return path.join(homedir, ".local", "share", "SMM");
  }
}

export function existingPathIfFile(filePath: string): string | undefined {
  return fs.existsSync(filePath) ? filePath : undefined;
}

export function bundledToolPath(
  binSubdir: string,
  exeName: string
): string | undefined {
  const resourcesPath = process.env.SMM_RESOURCES_PATH;
  if (!resourcesPath) {
    return undefined;
  }
  return existingPathIfFile(path.join(resourcesPath, "bin", binSubdir, exeName));
}

export function projectToolPath(binSubdir: string, exeName: string): string | undefined {
  return existingPathIfFile(path.join(getCliProjectRoot(), "bin", binSubdir, exeName));
}

export function installToolPath(binSubdir: string, exeName: string): string | undefined {
  return existingPathIfFile(path.join(getSmmDataDir(), "bin", binSubdir, exeName));
}

/** App auto-discovery: SMM_RESOURCES_PATH, then project bin, then install data dir. */
export function resolveAutoToolPath(binSubdir: string, exeName: string): string | undefined {
  return (
    bundledToolPath(binSubdir, exeName) ??
    projectToolPath(binSubdir, exeName) ??
    installToolPath(binSubdir, exeName)
  );
}

/** Runtime resolution: bundled first, then user override, then project, then install. */
export function resolveEffectiveToolPath(
  binSubdir: string,
  exeName: string,
  configuredPath: string | undefined
): string | undefined {
  return (
    bundledToolPath(binSubdir, exeName) ??
    (configuredPath ? existingPathIfFile(configuredPath) : undefined) ??
    projectToolPath(binSubdir, exeName) ??
    installToolPath(binSubdir, exeName)
  );
}
