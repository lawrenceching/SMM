import { getUserConfig } from "./config";
import { getTmpDir } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import crypto from "crypto";
import { execSync, spawn } from "child_process";
import { Path } from "@core/path";

const NUM_SCREENSHOTS = 5;

/** Escape a string for use inside double quotes in shell (e.g. paths with " in filename). */
function escapeForDoubleQuotedShell(s: string): string {
  return s.replace(/"/g, '""');
}

function getScreenshotCacheDir(videoPath: string): string {
  const absolutePath = path.resolve(videoPath);
  const hash = crypto
    .createHash("sha256")
    .update(absolutePath)
    .digest("hex")
    .slice(0, 32);
  return path.join(getTmpDir(), "screenshots", hash);
}

function readScreenshotCacheMeta(
  cacheDir: string
): { mtimeMs: number } | null {
  const metaPath = path.join(cacheDir, "meta.json");
  if (!fs.existsSync(metaPath)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as {
      mtimeMs?: number;
    };
    if (typeof data.mtimeMs !== "number") {
      return null;
    }
    return { mtimeMs: data.mtimeMs };
  } catch {
    return null;
  }
}

function isScreenshotCacheValid(cacheDir: string, mtimeMs: number): boolean {
  const meta = readScreenshotCacheMeta(cacheDir);
  if (!meta || meta.mtimeMs !== mtimeMs) {
    return false;
  }
  for (let i = 1; i <= NUM_SCREENSHOTS; i++) {
    const jpgPath = path.join(cacheDir, `${i}.jpg`);
    if (!fs.existsSync(jpgPath)) {
      return false;
    }
  }
  return true;
}

function getSmmDataDir(): string {
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

function getProjectRoot(): string {
  return path.resolve(__dirname, "../../../../");
}

export async function discoverFfmpeg(): Promise<string | undefined> {
  try {
    const userConfig = await getUserConfig();
    if (userConfig.ffmpegExecutablePath) {
      const customPath = userConfig.ffmpegExecutablePath;
      if (fs.existsSync(customPath)) {
        return customPath;
      }
    }
  } catch {
  }

  const resourcesPath = process.env.SMM_RESOURCES_PATH;
  if (resourcesPath) {
    const exeName = os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const bundledPath = path.join(resourcesPath, "bin", "ffmpeg", exeName);
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  }

  const projectRoot = getProjectRoot();
  const devBinPath = path.join(projectRoot, "bin/ffmpeg/ffmpeg.exe");
  if (fs.existsSync(devBinPath)) {
    return devBinPath;
  }

  const smmDataDir = getSmmDataDir();
  const installBinPath = path.join(smmDataDir, "bin/ffmpeg/ffmpeg.exe");
  if (fs.existsSync(installBinPath)) {
    return installBinPath;
  }

  return undefined;
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

export interface GenerateScreenshotsResult {
  screenshots?: string[];
  error?: string;
}

function getVideoDuration(videoPath: string, ffmpegPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ["-i", videoPath, "-f", "null", "-"], {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (durationMatch && durationMatch[1] && durationMatch[2] && durationMatch[3] && durationMatch[4]) {
        const hours = parseInt(durationMatch[1], 10);
        const minutes = parseInt(durationMatch[2], 10);
        const seconds = parseInt(durationMatch[3], 10);
        const centiseconds = parseInt(durationMatch[4], 10);
        const duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
        resolve(duration);
      } else {
        reject(new Error("failed to parse video duration"));
      }
    });

    child.on("error", reject);
  });
}

function generateScreenshot(
  ffmpegPath: string,
  videoPath: string,
  outputPath: string,
  timestamp: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, [
      "-ss", timestamp.toFixed(3),
      "-i", videoPath,
      "-vframes", "1",
      "-q:v", "2",
      "-y",
      outputPath,
    ], {
      stdio: ["ignore", "ignore", "inherit"],
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

export async function generateVideoScreenshots(
  videoPath: string
): Promise<GenerateScreenshotsResult> {
  if (!videoPath) {
    return { error: "video path is required" };
  }

  if (!fs.existsSync(videoPath)) {
    return { error: "video file not found" };
  }

  let mtimeMs: number;
  try {
    const stat = fs.statSync(videoPath);
    mtimeMs = stat.mtimeMs;
  } catch {
    return { error: "failed to read video file stats" };
  }

  const cacheDir = getScreenshotCacheDir(videoPath);
  if (isScreenshotCacheValid(cacheDir, mtimeMs)) {
    const screenshots = Array.from(
      { length: NUM_SCREENSHOTS },
      (_, i) => path.join(cacheDir, `${i + 1}.jpg`)
    );
    return { screenshots };
  }

  const ffmpegPath = await discoverFfmpeg();
  if (!ffmpegPath) {
    return { error: "ffmpeg executable not found" };
  }

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  let duration: number;
  try {
    duration = await getVideoDuration(videoPath, ffmpegPath);
  } catch (error) {
    return {
      error: `failed to get video duration: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }

  if (duration <= 0) {
    return { error: "invalid video duration" };
  }

  const screenshotPaths: string[] = [];
  const interval = duration / (NUM_SCREENSHOTS + 1);

  for (let i = 1; i <= NUM_SCREENSHOTS; i++) {
    const timestamp = interval * i;
    const screenshotPath = path.join(cacheDir, `${i}.jpg`);

    try {
      await generateScreenshot(ffmpegPath, videoPath, screenshotPath, timestamp);

      if (!fs.existsSync(screenshotPath)) {
        return { error: `failed to generate screenshot at ${timestamp}s` };
      }

      screenshotPaths.push(screenshotPath);
    } catch (error) {
      return {
        error: `failed to generate screenshot: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      };
    }
  }

  const metaPath = path.join(cacheDir, "meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify({ mtimeMs }),
    "utf-8"
  );

  return { screenshots: screenshotPaths };
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
  try {
    const userConfig = await getUserConfig();
    if (userConfig.ffprobeExecutablePath) {
      const customPath = userConfig.ffprobeExecutablePath;
      if (fs.existsSync(customPath)) {
        return customPath;
      }
    }
  } catch {
  }

  const resourcesPath = process.env.SMM_RESOURCES_PATH;
  if (resourcesPath) {
    const exeName = os.platform() === "win32" ? "ffprobe.exe" : "ffprobe";
    const bundledPath = path.join(resourcesPath, "bin", "ffmpeg", exeName);
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  }

  const projectRoot = getProjectRoot();
  const devBinPath = path.join(projectRoot, "bin/ffmpeg/ffprobe.exe");
  if (fs.existsSync(devBinPath)) {
    return devBinPath;
  }

  const smmDataDir = getSmmDataDir();
  const installBinPath = path.join(smmDataDir, "bin/ffmpeg/ffprobe.exe");
  if (fs.existsSync(installBinPath)) {
    return installBinPath;
  }

  return undefined;
}

export interface MediaTagsResult {
  tags?: Record<string, string>;
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
    if (result.format && result.format.tags) {
      return { tags: result.format.tags };
    }
    return { tags: {} };
  } catch (error) {
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