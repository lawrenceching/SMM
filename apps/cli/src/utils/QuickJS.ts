import { getUserConfig } from "./config";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { logger } from "../../lib/logger";
import {
  readConfiguredToolPath,
  resolveAutoToolPath,
  resolveEffectiveToolPath,
} from "./toolExecutableDiscovery";

const quickjsLog = logger.child({ module: "quickjs" });

function quickjsExeName(): string {
  return os.platform() === "win32" ? "qjs.exe" : "qjs";
}

async function readQuickJSConfiguredPath(): Promise<string | undefined> {
  return readConfiguredToolPath(async () => {
    const userConfig = await getUserConfig();
    return userConfig.quickjsExecutablePath;
  });
}

/** App auto-discovery (no user config): bundled -> project bin -> install dir -> PATH. */
export function discoverQuickjsAuto(): string | undefined {
  const resolved = resolveAutoToolPath("quickjs", quickjsExeName());
  if (resolved) {
    quickjsLog.debug({ resolved }, "resolved QuickJS via app auto-discovery");
  }
  return resolved;
}

/** Runtime: user config -> bundled -> project bin -> install dir -> PATH. */
export async function discoverQuickjs(): Promise<string | undefined> {
  const configured = await readQuickJSConfiguredPath();
  const resolved = resolveEffectiveToolPath("quickjs", quickjsExeName(), configured);
  if (resolved) {
    quickjsLog.debug({ resolved, configured: configured ?? null }, "resolved QuickJS executable");
    return resolved;
  }
  quickjsLog.debug("QuickJS executable not found in any location");
  return undefined;
}

export async function resolveQuickjsPathInfo(): Promise<{
  configuredPath: string | null;
  discoveredPath: string | null;
}> {
  const configured = (await readQuickJSConfiguredPath()) ?? null;
  const discovered = discoverQuickjsAuto() ?? null;
  return { configuredPath: configured, discoveredPath: discovered };
}

export interface QuickjsVersionResult {
  version?: string;
  error?: string;
}

export async function getQuickjsVersion(): Promise<QuickjsVersionResult> {
  const quickjsPath = await discoverQuickjs();

  if (!quickjsPath) {
    return { error: "QuickJS executable not found" };
  }

  try {
    const version = execSync(`"${quickjsPath}" --version`, {
      encoding: "utf-8",
      timeout: 10000,
    });
    return { version: version.trim() };
  } catch {
    return { error: "failed to execute QuickJS" };
  }
}
