import { getUserConfig } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import { execSync } from "child_process";

/**
 * Returns the SMM installation data directory path.
 * This is where bundled binaries like yt-dlp are stored.
 * - Windows: %LOCALAPPDATA%\SMM
 * - macOS: ~/Library/Application Support/SMM
 * - Linux: ~/.local/share/SMM
 */
function getSmmDataDir(): string {
  const platform = os.platform();
  const homedir = os.homedir();

  switch (platform) {
    case "win32":
      // Windows: %LOCALAPPDATA%\SMM
      return process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "SMM")
        : path.join(homedir, "AppData", "Local", "SMM");
    case "darwin":
      // macOS: ~/Library/Application Support/SMM
      return path.join(homedir, "Library", "Application Support", "SMM");
    case "linux":
      // Linux: ~/.local/share/SMM
      return process.env.XDG_DATA_HOME
        ? path.join(process.env.XDG_DATA_HOME, "SMM")
        : path.join(homedir, ".local", "share", "SMM");
    default:
      return path.join(homedir, ".local", "share", "SMM");
  }
}

/**
 * Gets the project root directory.
 * Goes up from src/utils/ (3 levels) to reach workspace root: utils -> src -> cli -> apps -> root.
 */
function getProjectRoot(): string {
  return path.resolve(__dirname, "../../../../");
}

/**
 * Discovers yt-dlp binary executable path.
 * Searches in sequence:
 * 1. ytdlpExecutablePath in user config
 * 2. bin/yt-dlp/yt-dlp.exe in project root
 * 3. bin/yt-dlp/yt-dlp.exe in SMM installation path
 */
export async function discoverYtdlp(): Promise<string | undefined> {
  // 1. Check user config for custom path
  try {
    const userConfig = await getUserConfig();
    if (userConfig.ytdlpExecutablePath) {
      const customPath = userConfig.ytdlpExecutablePath;
      if (fs.existsSync(customPath)) {
        return customPath;
      }
    }
  } catch {
    // User config doesn't exist or is invalid, continue to next step
  }

  // 2. Check project root bin folder
  const projectRoot = getProjectRoot();
  const devBinPath = path.join(projectRoot, "bin/yt-dlp/yt-dlp.exe");
  if (fs.existsSync(devBinPath)) {
    return devBinPath;
  }

  // 3. Check SMM installation path
  const smmDataDir = getSmmDataDir();
  const installBinPath = path.join(smmDataDir, "bin/yt-dlp/yt-dlp.exe");
  if (fs.existsSync(installBinPath)) {
    return installBinPath;
  }

  return undefined;
}

/**
 * Result of getting yt-dlp version
 */
export interface YtdlpVersionResult {
  version?: string;
  error?: string;
}

/**
 * Gets the yt-dlp version by executing yt-dlp --version
 * @returns The version string if successful, or error message if failed
 */
export async function getYtdlpVersion(): Promise<YtdlpVersionResult> {
  const ytdlpPath = await discoverYtdlp();

  if (!ytdlpPath) {
    return { error: "yt-dlp executable not found" };
  }

  try {
    const version = execSync(`"${ytdlpPath}" --version`, {
      encoding: "utf-8",
      timeout: 10000,
    });
    return { version: version.trim() };
  } catch {
    return { error: "failed to execute yt-dlp" };
  }
}