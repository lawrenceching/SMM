import { getUserConfig } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import { spawn, execSync } from "child_process";

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

  // 2. Check bundled resources (when running under Electron)
  const resourcesPath = process.env.SMM_RESOURCES_PATH;
  if (resourcesPath) {
    const exeName = os.platform() === "win32" ? "yt-dlp.exe" : "yt-dlp";
    const bundledPath = path.join(resourcesPath, "bin", "yt-dlp", exeName);
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  }

  // 3. Check project root bin folder
  const projectRoot = getProjectRoot();
  const devBinPath = path.join(projectRoot, "bin/yt-dlp/yt-dlp.exe");
  if (fs.existsSync(devBinPath)) {
    return devBinPath;
  }

  // 4. Check SMM installation path
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

/**
 * Allowed yt-dlp arguments for download
 */
const ALLOWED_ARGS = ["--write-thumbnail", "--embed-thumbnail", "--embed-metadata"];

/**
 * Request data for yt-dlp download
 */
export interface YtdlpDownloadRequestData {
  url: string;
  args?: string[];
  folder?: string;
}

/**
 * Result of yt-dlp download
 */
export interface YtdlpDownloadResult {
  success?: boolean;
  error?: string;
  path?: string;
}

/**
 * Result of extracting video data
 */
export interface YtdlpVideoDataResult {
  title?: string;
  artist?: string;
  error?: string;
}

/**
 * Validates that only allowed arguments are provided
 * @param args - Array of command-line arguments
 * @returns true if all args are allowed, false otherwise
 */
function validateArgs(args?: string[]): boolean {
  if (!args || args.length === 0) {
    return true;
  }
  return args.every((arg) => ALLOWED_ARGS.includes(arg));
}

/**
 * Downloads a video using yt-dlp
 * @param request - Download request containing url and optional args
 * @returns Result with success or error
 */
export async function downloadYtdlpVideo(
  request: YtdlpDownloadRequestData
): Promise<YtdlpDownloadResult> {
  // Validate URL
  if (!request.url) {
    return { error: "url is required" };
  }

  // Validate args
  if (request.args && !validateArgs(request.args)) {
    return {
      error: `Only allowed args are: ${ALLOWED_ARGS.join(", ")}`,
    };
  }

  // Discover yt-dlp
  const ytdlpPath = await discoverYtdlp();
  if (!ytdlpPath) {
    return { error: "yt-dlp executable not found" };
  }

  // Build command arguments
  const cmdArgs = [ytdlpPath];

  // Add output directory (default to ~/Downloads)
  const outputDir = request.folder || path.join(os.homedir(), "Downloads");
  const outputTemplate = path.join(outputDir, "%(title)s [%(id)s].%(ext)s");
  cmdArgs.push("--output", outputTemplate);

  // Add --print to get the final filepath after post-processing
  cmdArgs.push("--print", "after_move:filepath");

  cmdArgs.push(request.url);
  if (request.args && request.args.length > 0) {
    cmdArgs.push(...request.args);
  }

  // Execute yt-dlp
  let downloadedPath = "";
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(ytdlpPath, cmdArgs.slice(1), {
        stdio: ["inherit", "pipe", "inherit"],
      });
      let stdout = "";
      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      child.on("close", (code) => {
        if (code === 0) {
          // Parse the output to get the filepath (last non-empty line)
          const lines = stdout.trim().split("\n").filter((l) => l.trim());
          downloadedPath = lines[lines.length - 1]?.trim() || outputDir;
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });
      child.on("error", reject);
    });
    return { success: true, path: downloadedPath };
  } catch (error) {
    return {
      error: `yt-dlp download failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Extracts video metadata (title and artist) using yt-dlp
 * @param url - The video URL to extract data from
 * @returns Result containing title and artist, or error if failed
 */
export async function extractVideoData(
  url: string
): Promise<YtdlpVideoDataResult> {
  if (!url) {
    return { error: "url is required" };
  }

  const ytdlpPath = await discoverYtdlp();
  if (!ytdlpPath) {
    return { error: "yt-dlp executable not found" };
  }

  try {
    const output = execSync(`"${ytdlpPath}" --skip-download --print "title=%(title)s ___ artist=%(uploader)s" "${url}"`, {
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["ignore", "pipe", "ignore"],
    });

    const lines = output.trim().split("\n");
    const dataLine = lines.find(
      (line) => line.includes("title=") && line.includes("___ artist=")
    );

    if (!dataLine) {
      return { error: "failed to parse video data from output" };
    }

    const parts = dataLine.split("___");
    let title: string | undefined;
    let artist: string | undefined;

    for (const part of parts) {
      const trimmedPart = part.trim();
      if (trimmedPart.startsWith("title=")) {
        title = trimmedPart.substring(6).trim();
      } else if (trimmedPart.startsWith("artist=")) {
        artist = trimmedPart.substring(7).trim();
      }
    }

    if (!title) {
      return { error: "title not found in yt-dlp output" };
    }

    return { title, artist };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("URL")) {
        return { error: "invalid URL provided" };
      }
      if (error.message.includes("timeout")) {
        return { error: "request timed out" };
      }
      return { error: `yt-dlp failed: ${error.message}` };
    }
    return { error: "unknown error occurred while extracting video data" };
  }
}