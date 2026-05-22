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

export function getSystemPathEnv(): string | undefined {
  return process.env.PATH ?? process.env.Path;
}

/** First existing executable on PATH (or Path on Windows). */
export function findExecutableOnSystemPath(
  exeName: string,
  pathEnv?: string
): string | undefined {
  const raw = pathEnv ?? getSystemPathEnv();
  if (!raw?.trim()) {
    return undefined;
  }
  const sep = process.platform === "win32" ? ";" : ":";
  for (const dir of raw.split(sep)) {
    const trimmed = dir.trim();
    if (!trimmed) {
      continue;
    }
    const candidate = path.join(trimmed, exeName);
    const resolved = existingPathIfFile(candidate);
    if (resolved) {
      return path.resolve(resolved);
    }
  }
  return undefined;
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

/** First existing path in extraCandidates (tool-specific, e.g. Python Scripts). */
export function firstExistingCandidate(
  candidates: readonly string[]
): string | undefined {
  for (const candidate of candidates) {
    const resolved = existingPathIfFile(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return undefined;
}

/**
 * App auto-discovery: SMM_RESOURCES_PATH → project bin → install data dir → system PATH.
 * Does not include user config or tool-specific extra candidates.
 */
export function resolveAutoToolPath(binSubdir: string, exeName: string): string | undefined {
  return (
    bundledToolPath(binSubdir, exeName) ??
    projectToolPath(binSubdir, exeName) ??
    installToolPath(binSubdir, exeName) ??
    findExecutableOnSystemPath(exeName)
  );
}

/**
 * Auto-discovery plus optional extra candidates (after PATH), e.g. Python Scripts for videocaptioner.
 */
export function resolveAutoToolPathWithExtras(
  binSubdir: string,
  exeName: string,
  extraCandidates?: readonly string[]
): string | undefined {
  return (
    resolveAutoToolPath(binSubdir, exeName) ??
    (extraCandidates?.length ? firstExistingCandidate(extraCandidates) : undefined)
  );
}

/**
 * Runtime resolution: user config (if file exists) → auto chain (1–4) → extra candidates.
 */
export function resolveEffectiveToolPath(
  binSubdir: string,
  exeName: string,
  configuredPath: string | undefined,
  extraCandidates?: readonly string[]
): string | undefined {
  if (configuredPath) {
    const configured = existingPathIfFile(configuredPath);
    if (configured) {
      return configured;
    }
  }
  return resolveAutoToolPathWithExtras(binSubdir, exeName, extraCandidates);
}

export async function readConfiguredToolPath(
  getter: () => Promise<string | undefined>
): Promise<string | undefined> {
  try {
    const configured = (await getter())?.trim();
    return configured || undefined;
  } catch {
    return undefined;
  }
}
