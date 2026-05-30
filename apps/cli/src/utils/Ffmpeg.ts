import { getUserConfig } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import { execSync, spawn } from "child_process";
import { Path } from "@core/path";
import { logger } from "../../lib/logger";

/** Escape a string for use inside double quotes in shell (e.g. paths with " in filename). */
function escapeForDoubleQuotedShell(s: string): string {
  return s.replace(/"/g, '""');
}

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
    return userConfig.ffprobeExecutablePath;
  });
}

/** App auto-discovery (no user config): bundled → project bin → install dir → PATH. */
export function discoverFfmpegAuto(): string | undefined {
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

export interface FfmpegVersionResult {
  version?: string;
  error?: string;
}

export async function getFfmpegVersion(): Promise<FfmpegVersionResult> {
  const ffmpegPath = await discoverFfmpeg();

  if (!ffmpegPath) {
    return { error: "ffmpeg executable not found" };
  }

  try {
    const output = execSync(`"${ffmpegPath}" -version`, {
      encoding: "utf-8",
      timeout: 10000,
    });

    const lines = output.trim().split("\n");
    const firstLine = lines[0];
    if (!firstLine) {
      return { error: "failed to parse ffmpeg version" };
    }
    const match = firstLine.match(/ffmpeg version (.+)/);

    if (match && match[1]) {
      return { version: match[1] };
    }

    return { error: "failed to parse ffmpeg version" };
  } catch {
    return { error: "failed to execute ffmpeg" };
  }
}

// --- Format conversion ---

export type ConvertFormat = "mp4h264" | "mp4h265" | "webm" | "mkv";
export type ConvertPreset = "quality" | "balanced" | "speed";

export interface ConvertVideoOptions {
  format: ConvertFormat;
  preset: ConvertPreset;
}

export interface ConvertVideoResult {
  error?: string;
}

function buildConvertArgs(
  inputPath: string,
  outputPath: string,
  options: ConvertVideoOptions
): string[] {
  const { format, preset } = options;
  const args: string[] = ["-i", inputPath];

  switch (format) {
    case "mp4h264": {
      const crf = preset === "quality" ? "18" : preset === "balanced" ? "23" : "23";
      const x264Preset =
        preset === "quality" ? "slow" : preset === "balanced" ? "medium" : "veryfast";
      args.push("-c:v", "libx264", "-crf", crf, "-preset", x264Preset);
      args.push("-c:a", "copy");
      break;
    }
    case "mp4h265": {
      const crf = preset === "quality" ? "20" : preset === "balanced" ? "26" : "28";
      const x265Preset =
        preset === "quality" ? "slow" : preset === "balanced" ? "medium" : "fast";
      args.push("-c:v", "libx265", "-crf", crf, "-preset", x265Preset);
      args.push("-c:a", "copy");
      break;
    }
    case "webm": {
      const crf = preset === "quality" ? "30" : preset === "balanced" ? "35" : "40";
      args.push("-c:v", "libvpx-vp9", "-crf", crf, "-b:v", "0");
      if (preset === "speed") {
        args.push("-deadline", "realtime");
      } else if (preset === "balanced") {
        args.push("-deadline", "good");
      }
      args.push("-c:a", "libopus", "-b:a", "128k");
      break;
    }
    case "mkv": {
      const crf = preset === "quality" ? "18" : preset === "balanced" ? "23" : "23";
      const x264Preset =
        preset === "quality" ? "slow" : preset === "balanced" ? "medium" : "veryfast";
      args.push("-c:v", "libx264", "-crf", crf, "-preset", x264Preset);
      args.push("-c:a", "copy");
      break;
    }
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  args.push("-y", outputPath);
  return args;
}

function runFfmpegConvert(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  options: ConvertVideoOptions
): Promise<{ error?: string }> {
  return new Promise((resolve) => {
    const args = buildConvertArgs(inputPath, outputPath, options);
    const child = spawn(ffmpegPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({});
        return;
      }
      const lastLines = stderr.trim().split("\n").slice(-5).join(" ");
      resolve({
        error: `ffmpeg exited with code ${code}${lastLines ? `: ${lastLines}` : ""}`,
      });
    });

    child.on("error", (err) => {
      resolve({
        error: `ffmpeg spawn error: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    });
  });
}

export async function convertVideo(
  inputPath: string,
  outputPath: string,
  options: ConvertVideoOptions
): Promise<ConvertVideoResult> {
  if (!inputPath) {
    return { error: "input path is required" };
  }
  if (!outputPath) {
    return { error: "output path is required" };
  }

  const ffmpegPath = await discoverFfmpeg();
  if (!ffmpegPath) {
    return { error: "ffmpeg executable not found" };
  }

  const inputPathObj = new Path(inputPath);
  const outputPathObj = new Path(outputPath);
  const absInput = inputPathObj.platformAbsPath();
  const absOutput = outputPathObj.platformAbsPath();

  if (!fs.existsSync(absInput)) {
    return { error: "input file not found" };
  }

  const outputDir = path.dirname(absOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return runFfmpegConvert(ffmpegPath, absInput, absOutput, options);
}

export async function discoverFfprobe(): Promise<string | undefined> {
  const configured = await readFfprobeConfiguredPath();
  return resolveEffectiveToolPath("ffmpeg", ffprobeExeName(), configured);
}

export interface MediaTagsResult {
  tags?: Record<string, string>;
  /** Duration in seconds; from format.duration or first stream with duration when format lacks it. */
  duration?: number;
  error?: string;
}

export async function getMediaTags(filePath: string): Promise<MediaTagsResult> {
  if (!filePath) {
    return { error: "file path is required" };
  }

  const ffprobePath = await discoverFfprobe();
  if (!ffprobePath) {
    return { error: "ffprobe executable not found" };
  }

  if (!fs.existsSync(filePath)) {
    return { error: `File not found: ${filePath}` };
  }

  try {
    const output = execSync(
      `"${escapeForDoubleQuotedShell(ffprobePath)}" -v quiet -print_format json -show_format -show_streams "${escapeForDoubleQuotedShell(filePath)}"`,
      {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const result = JSON.parse(output);
    const format = result.format;
    if (!format) {
      return { tags: {} };
    }
    const tags = format.tags ?? {};
    let durationRaw =
      format.duration != null && format.duration !== ""
        ? Number.parseFloat(String(format.duration))
        : NaN;
    if (!Number.isFinite(durationRaw) && Array.isArray(result.streams)) {
      for (const stream of result.streams) {
        const d =
          stream.duration != null && stream.duration !== ""
            ? Number.parseFloat(String(stream.duration))
            : NaN;
        if (Number.isFinite(d)) {
          durationRaw = d;
          break;
        }
      }
    }
    const duration =
      Number.isFinite(durationRaw) && durationRaw >= 0 ? durationRaw : undefined;
    return { tags, ...(duration !== undefined && { duration }) };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ err, filePath }, 'Unable to read tags by ffprobe');
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return { error: "request timed out" };
      }
      if (error.message.includes("Invalid data")) {
        return { error: "invalid media file format" };
      }
      return { error: `ffprobe failed: ${error.message}` };
    }
    return { error: "unknown error occurred while reading media tags" };
  }
}

export interface WriteMediaTagsResult {
  success?: boolean;
  error?: string;
}

export async function writeMediaTags(
  filePath: string,
  tags: Record<string, string>
): Promise<WriteMediaTagsResult> {
  if (!filePath) {
    return { error: "file path is required" };
  }

  if (!tags || Object.keys(tags).length === 0) {
    return { error: "tags are required" };
  }

  const ffmpegPath = await discoverFfmpeg();
  if (!ffmpegPath) {
    return { error: "ffmpeg executable not found" };
  }

  if (!fs.existsSync(filePath)) {
    return { error: `File not found: ${filePath}` };
  }

  try {
    const parsedPath = path.parse(filePath);
    const tempFilePath = path.join(parsedPath.dir, `${parsedPath.name}.temp${parsedPath.ext}`);

    const args = ["-i", filePath, "-c", "copy"];
    
    for (const [key, value] of Object.entries(tags)) {
      args.push("-metadata", `${key}=${value}`);
    }

    args.push("-y", tempFilePath);

    execSync(
      `"${escapeForDoubleQuotedShell(ffmpegPath)}" ${args.map((arg) => `"${escapeForDoubleQuotedShell(arg)}"`).join(" ")}`,
      {
        encoding: "utf-8",
        timeout: 60000,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    if (!fs.existsSync(tempFilePath)) {
      return { error: "failed to create temporary file with new tags" };
    }

    fs.unlinkSync(filePath);
    fs.renameSync(tempFilePath, filePath);

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return { error: "request timed out" };
      }
      if (error.message.includes("Permission denied")) {
        return { error: "permission denied to write file" };
      }
      return { error: `ffmpeg failed: ${error.message}` };
    }
    return { error: "unknown error occurred while writing media tags" };
  }
}