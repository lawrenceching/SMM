import { getUserConfig } from "./config";
import { getTmpDir } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import { execSync, spawn } from "child_process";
import { Path } from "@core/path";

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

  const ffmpegPath = await discoverFfmpeg();
  if (!ffmpegPath) {
    return { error: "ffmpeg executable not found" };
  }

  const tempDir = getTmpDir();
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const videoPathObj = new Path(videoPath);
  const screenshotFilePrefix = path.join(
    tempDir,
    videoPathObj.name().replace(/\.[^/.]+$/, "")
  );

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

  const numScreenshots = 5;
  const screenshotPaths: string[] = [];

  const interval = duration / (numScreenshots + 1);

  for (let i = 1; i <= numScreenshots; i++) {
    const timestamp = interval * i;
    const screenshotPath = `${screenshotFilePrefix}_${i}.jpg`;

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

  return { screenshots: screenshotPaths };
}