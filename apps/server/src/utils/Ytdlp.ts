import { getUserConfig } from "./config";
import os from "os";
import { spawn, execSync } from "child_process";
import { logger } from "../../lib/logger";
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
function discoverYtdlpAuto(): string | undefined {
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