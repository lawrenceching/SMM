import { getUserConfig, getTmpDir } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import { mkdir, rename, rm, readdir } from "fs/promises";
import { spawn, execSync } from "child_process";
import { logger } from "../../lib/logger";
import { discoverFfmpeg } from "./Ffmpeg";

const ytdlpLog = logger.child({ module: "ytdlp" });

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
        ytdlpLog.debug(
          { source: "userConfig", path: customPath },
          "resolved yt-dlp executable"
        );
        return customPath;
      }
      ytdlpLog.debug(
        { source: "userConfig", path: customPath, exists: false },
        "ytdlpExecutablePath in config but file missing"
      );
    }
  } catch {
    // User config doesn't exist or is invalid, continue to next step
  }

  const exeName = os.platform() === "win32" ? "yt-dlp.exe" : "yt-dlp";

  // 2. Check bundled resources (when running under Electron)
  const resourcesPath = process.env.SMM_RESOURCES_PATH;
  if (resourcesPath) {
    const bundledPath = path.join(resourcesPath, "bin", "yt-dlp", exeName);
    if (fs.existsSync(bundledPath)) {
      ytdlpLog.debug(
        { source: "SMM_RESOURCES_PATH", path: bundledPath },
        "resolved yt-dlp executable"
      );
      return bundledPath;
    }
    ytdlpLog.debug(
      { source: "SMM_RESOURCES_PATH", path: bundledPath, exists: false },
      "bundled yt-dlp path missing"
    );
  }

  // 3. Check project root bin folder
  const projectRoot = getProjectRoot();
  const devBinPath = path.join(projectRoot, "bin/yt-dlp", exeName);
  if (fs.existsSync(devBinPath)) {
    ytdlpLog.debug(
      { source: "projectRoot", path: devBinPath },
      "resolved yt-dlp executable"
    );
    return devBinPath;
  }

  // 4. Check SMM installation path
  const smmDataDir = getSmmDataDir();
  const installBinPath = path.join(smmDataDir, "bin/yt-dlp", exeName);
  if (fs.existsSync(installBinPath)) {
    ytdlpLog.debug(
      { source: "installDataDir", path: installBinPath },
      "resolved yt-dlp executable"
    );
    return installBinPath;
  }

  ytdlpLog.debug(
    {
      checked: {
        devBinPath,
        installBinPath,
        resourcesPath: resourcesPath ?? null,
      },
    },
    "yt-dlp executable not found in any location"
  );
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
  /** yt-dlp `-f` format selector (e.g. `137`, `best`). */
  format?: string;
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

export type RunYtdlpPlaylistDumpResult =
  | { stdout: string }
  | { error: string };

/**
 * Runs `yt-dlp -j <url>` and returns raw stdout (NDJSON lines). Parsing is left to the client.
 */
export async function runYtdlpPlaylistDump(
  url: string
): Promise<RunYtdlpPlaylistDumpResult> {
  if (!url) {
    return { error: "url is required" };
  }

  const ytdlpPath = await discoverYtdlp();
  if (!ytdlpPath) {
    return { error: "yt-dlp executable not found" };
  }

  const spawnArgs = ["-j", url];
  ytdlpLog.debug(
    { ytdlpPath, spawnArgs, url },
    "runYtdlpPlaylistDump: spawning yt-dlp"
  );

  try {
    const child = spawn(ytdlpPath, spawnArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      process.stderr.write(data);
    });

    const exitPromise = new Promise<number>((resolve, reject) => {
      child.once("close", (code) => resolve(code ?? 0));
      child.once("error", reject);
    });

    if (!child.stdout) {
      return { error: "yt-dlp stdout is not available" };
    }

    const chunks: Buffer[] = [];
    const stdoutEnd = new Promise<void>((resolve, reject) => {
      child.stdout!.on("data", (d: string | Buffer) => {
        chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d, "utf8"));
      });
      child.stdout!.once("end", () => resolve());
      child.stdout!.once("error", reject);
    });

    const [exitCode] = await Promise.all([exitPromise, stdoutEnd]);
    const stdout = Buffer.concat(chunks).toString("utf8");

    if (exitCode !== 0) {
      const tail = stderr.trim().slice(-2000);
      return {
        error: `yt-dlp exited with code ${exitCode}${tail ? `: ${tail}` : ""}`,
      };
    }

    return { stdout };
  } catch (error) {
    ytdlpLog.debug(
      { err: error instanceof Error ? error.message : error, url },
      "runYtdlpPlaylistDump: failed"
    );
    return {
      error: `yt-dlp failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
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
  request: YtdlpDownloadRequestData,
  signal?: AbortSignal
): Promise<YtdlpDownloadResult> {
  if (!request.url) {
    return { error: "url is required" };
  }

  if (request.args && !validateArgs(request.args)) {
    return {
      error: `Only allowed args are: ${ALLOWED_ARGS.join(", ")}`,
    };
  }

  const ytdlpPath = await discoverYtdlp();
  if (!ytdlpPath) {
    return { error: "yt-dlp executable not found" };
  }

  const ffmpegPath = await discoverFfmpeg();

  const finalDir = request.folder || path.join(os.homedir(), "Downloads");
  const tmpBase = getTmpDir();
  const tempDir = path.join(tmpBase, `ytdlp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  try {
    await mkdir(tempDir, { recursive: true });
  } catch {
    return { error: "failed to create temp directory for download" };
  }

  const cmdArgs = [ytdlpPath];
  const tempOutputTemplate = path.join(tempDir, "%(title)s [%(id)s].%(ext)s");
  cmdArgs.push("--output", tempOutputTemplate);
  cmdArgs.push("--print", "after_move:filepath");

  if (ffmpegPath) {
    cmdArgs.push("--ffmpeg-location", ffmpegPath);
    ytdlpLog.debug({ ffmpegPath }, "download: passing --ffmpeg-location");
  } else {
    ytdlpLog.debug(
      {},
      "download: ffmpeg not discovered; yt-dlp merge/postprocess may fail"
    );
  }

  const format = request.format?.trim();
  if (format) {
    cmdArgs.push("-f", format);
  }

  cmdArgs.push(request.url);
  if (request.args && request.args.length > 0) {
    cmdArgs.push(...request.args);
  }

  const spawnArgs = cmdArgs.slice(1);
  ytdlpLog.debug(
    {
      ytdlpPath,
      ffmpegPath: ffmpegPath ?? null,
      tempDir,
      finalDir,
      tempOutputTemplate,
      format: format ?? null,
      extraArgs: request.args ?? [],
      spawnArgs,
      url: request.url,
    },
    "download: spawning yt-dlp with temp directory"
  );

  let downloadedPath = "";
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(ytdlpPath, spawnArgs, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";

      const onAbort = () => {
        ytdlpLog.warn({ ytdlpPath, spawnArgs }, "download: abort signal received, killing yt-dlp");
        child.kill("SIGTERM");
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr?.on("data", (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
      child.on("close", (code) => {
        signal?.removeEventListener("abort", onAbort);
        if (code === 0) {
          const lines = stdout.trim().split("\n").filter((l) => l.trim());
          downloadedPath = lines[lines.length - 1]?.trim() || "";
          ytdlpLog.debug(
            {
              exitCode: code,
              downloadedPath,
              stdoutLineCount: lines.length,
              stderrByteLength: stderr.length,
            },
            "download: yt-dlp finished successfully"
          );
          if (stderr.trim()) {
            ytdlpLog.debug({ stderr }, "download: yt-dlp stderr (non-fatal)");
          }
          resolve();
        } else {
          ytdlpLog.debug(
            {
              exitCode: code,
              stdout,
              stderr,
            },
            "download: yt-dlp exited with error"
          );
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });
      child.on("error", (err) => {
        signal?.removeEventListener("abort", onAbort);
        ytdlpLog.debug(
          { err, ytdlpPath, spawnArgs },
          "download: failed to spawn yt-dlp"
        );
        reject(err);
      });
    });

    const tempFiles = await readdir(tempDir);
    await mkdir(finalDir, { recursive: true });

    let movedMainFile = "";
    try {
      for (const file of tempFiles) {
        const tempFilePath = path.join(tempDir, file);
        const finalFilePath = path.join(finalDir, file);
        await rename(tempFilePath, finalFilePath);
        if (downloadedPath && path.resolve(tempFilePath) === path.resolve(downloadedPath)) {
          movedMainFile = finalFilePath;
        }
      }
    } catch (moveError) {
      ytdlpLog.error(
        { err: moveError instanceof Error ? moveError.message : moveError, tempDir, finalDir },
        "download: failed to move files from temp to final directory, keeping temp files"
      );
      return {
        error: `Failed to move downloaded file to destination: ${
          moveError instanceof Error ? moveError.message : "Unknown error"
        }`,
      };
    }

    if (!movedMainFile && downloadedPath) {
      movedMainFile = path.join(finalDir, path.basename(downloadedPath));
    }

    ytdlpLog.debug(
      { tempFiles, finalDir, movedMainFile },
      "download: moved files from temp to final directory"
    );

    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {}

    return { success: true, path: movedMainFile || downloadedPath };
  } catch (error) {
    ytdlpLog.debug(
      {
        err: error instanceof Error ? error.message : error,
      },
      "download: caught error after spawn"
    );
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {}
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

  ytdlpLog.debug(
    { ytdlpPath, url },
    "extractVideoData: running yt-dlp --skip-download"
  );

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

    ytdlpLog.debug({ title, artist }, "extractVideoData: parsed result");
    return { title, artist };
  } catch (error) {
    ytdlpLog.debug(
      {
        err: error instanceof Error ? error.message : error,
        url,
      },
      "extractVideoData: execSync failed"
    );
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