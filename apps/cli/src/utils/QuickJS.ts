import { getUserConfig } from "./config";
import os from "os";
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
function discoverQuickjsAuto(): string | undefined {
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
