import { getUserConfig, getTmpDir } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import { mkdir, rename, rm, readdir } from "fs/promises";
import { spawn, execSync } from "child_process";
import { logger } from "../../lib/logger";
import { discoverFfmpeg } from "./Ffmpeg";
import {
  readConfiguredToolPath,
  resolveAutoToolPath,
  resolveEffectiveToolPath,
} from "./toolExecutableDiscovery";

const ytdlpLog = logger.child({ module: "ytdlp" });

function ytdlpExeName(): string {
  return os.platform() === "win32" ? "yt-dlp.exe" : "yt-dlp";
}

async function readYtdlpConfiguredPath(): Promise<string | undefined> {
  return readConfiguredToolPath(async () => {
    const userConfig = await getUserConfig();
    return userConfig.ytdlpExecutablePath;
  });
}

/** App auto-discovery (no user config): bundled → project bin → install dir → PATH. */
export function discoverYtdlpAuto(): string | undefined {
  const resolved = resolveAutoToolPath("yt-dlp", ytdlpExeName());
  if (resolved) {
    ytdlpLog.debug({ resolved }, "resolved yt-dlp via app auto-discovery");
  }
  return resolved;
}

/** Runtime: user config → bundled → project bin → install dir → PATH. */
export async function discoverYtdlp(): Promise<string | undefined> {
  const configured = await readYtdlpConfiguredPath();
  const resolved = resolveEffectiveToolPath("yt-dlp", ytdlpExeName(), configured);
  if (resolved) {
    ytdlpLog.debug({ resolved, configured: configured ?? null }, "resolved yt-dlp executable");
    return resolved;
  }
  ytdlpLog.debug("yt-dlp executable not found in any location");
  return undefined;
}

export async function resolveYtdlpPathInfo(): Promise<{
  configuredPath: string | null;
  discoveredPath: string | null;
}> {
  const configured = (await readYtdlpConfiguredPath()) ?? null;
  const discovered = discoverYtdlpAuto() ?? null;
  return { configuredPath: configured, discoveredPath: discovered };
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