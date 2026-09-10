import { getUserConfig } from "./config";
import os from "os";
import { logger } from "../../lib/logger";


import {
  getCliProjectRoot,
  getSmmDataDir,
  readConfiguredToolPath,
  resolveAutoToolPath,
  resolveEffectiveToolPath,
} from "./toolExecutableDiscovery";

function ffmpegExeName(): string {
  return os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg";
}

function ffprobeExeName(): string {
  return os.platform() === "win32" ? "ffprobe.exe" : "ffprobe";
}

async function readFfmpegConfiguredPath(): Promise<string | undefined> {
  return readConfiguredToolPath(async () => {
    const userConfig = await getUserConfig();
    return userConfig.ffmpegExecutablePath;
  });
}

async function readFfprobeConfiguredPath(): Promise<string | undefined> {
  return readConfiguredToolPath(async () => {
    const userConfig = await getUserConfig();
    const ffmpeg = userConfig.ffmpegExecutablePath;
    if (!ffmpeg) return undefined;
    return ffmpeg.replace(/ffmpeg(\.exe)?$/i, (_match, ext: string | undefined) =>
      `ffprobe${ext ?? ""}`,
    );
  });
}

/** App auto-discovery (no user config): bundled → project bin → install dir → PATH. */
function discoverFfmpegAuto(): string | undefined {
  const resolved = resolveAutoToolPath("ffmpeg", ffmpegExeName());
  if (resolved) {
    logger.info({ resolved }, "discoverFfmpegAuto: resolved ffmpeg");
  }
  return resolved;
}

export async function discoverFfmpeg(): Promise<string | undefined> {
  logger.debug(
    {
      platform: os.platform(),
      cwd: process.cwd(),
      resourcesPath: process.env.SMM_RESOURCES_PATH,
      projectRoot: getCliProjectRoot(),
      smmDataDir: getSmmDataDir(),
    },
    "discoverFfmpeg: start"
  );

  const configured = await readFfmpegConfiguredPath();
  const resolved = resolveEffectiveToolPath("ffmpeg", ffmpegExeName(), configured);
  if (resolved) {
    logger.info({ resolved, configured: configured ?? null }, "discoverFfmpeg: resolved ffmpeg");
    return resolved;
  }
  logger.warn("discoverFfmpeg: ffmpeg not found in any known location");
  return undefined;
}

export async function resolveFfmpegPathInfo(): Promise<{
  configuredPath: string | null;
  discoveredPath: string | null;
}> {
  const configured = (await readFfmpegConfiguredPath()) ?? null;
  const discovered = discoverFfmpegAuto() ?? null;
  return { configuredPath: configured, discoveredPath: discovered };
}


export async function discoverFfprobe(): Promise<string | undefined> {
  const configured = await readFfprobeConfiguredPath();
  return resolveEffectiveToolPath("ffmpeg", ffprobeExeName(), configured);
}
