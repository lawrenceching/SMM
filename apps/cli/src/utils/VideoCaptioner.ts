import { getUserConfig } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import { spawn } from "child_process";
import { logger } from "../../lib/logger";
import { discoverFfmpeg } from "./Ffmpeg";

const videoCaptionerLog = logger.child({ module: "videocaptioner" });
export const TRANSCRIBE_TIMEOUT_MS = 10 * 60 * 1000;

async function resolveSpawnEnvForVideoCaptioner(): Promise<NodeJS.ProcessEnv | undefined> {
  let env: NodeJS.ProcessEnv | undefined;
  try {
    const userConfig = await getUserConfig();
    if (userConfig.useBundledFfmpegForVideoCaptioner) {
      const ffmpegPath = await discoverFfmpeg();
      if (ffmpegPath) {
        const ffmpegDir = path.dirname(ffmpegPath);
        const baseEnv: NodeJS.ProcessEnv = { ...process.env };
        const currentPath = baseEnv.PATH || baseEnv.Path || "";
        const sep = process.platform === "win32" ? ";" : ":";
        const newPath = ffmpegDir + (currentPath ? sep + currentPath : "");
        baseEnv.PATH = newPath;
        baseEnv.Path = newPath;
        env = baseEnv;
        videoCaptionerLog.info(
          { ffmpegPath, ffmpegDir, useBundledFfmpegForVideoCaptioner: true },
          "configured PATH for videocaptioner to prefer bundled ffmpeg"
        );
      } else {
        videoCaptionerLog.warn(
          { useBundledFfmpegForVideoCaptioner: true },
          "useBundledFfmpegForVideoCaptioner is enabled but bundled ffmpeg was not found"
        );
      }
    }
  } catch (error) {
    videoCaptionerLog.warn(
      { error },
      "failed to read user config for useBundledFfmpegForVideoCaptioner; falling back to default PATH"
    );
  }
  return env;
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

function getWindowsDriveRootFromPosixHome(homeDir: string): string | undefined {
  const match = homeDir.match(/^\/([a-zA-Z])\//);
  if (!match || !match[1]) return undefined;
  return `/${match[1].toLowerCase()}`;
}

export function getPythonScriptsCandidatePaths(exeName: string): string[] {
  const candidates = new Set<string>();
  const homeDir = os.homedir();
  const platform = os.platform();

  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
    // Typical CPython installer path:
    // C:\Users\<user>\AppData\Local\Programs\Python\Python310\Scripts\videocaptioner.exe
    candidates.add(path.join(localAppData, "Programs", "Python", "Python310", "Scripts", exeName));
    candidates.add(path.join(localAppData, "Programs", "Python", "Python311", "Scripts", exeName));
    candidates.add(path.join(localAppData, "Programs", "Python", "Python312", "Scripts", exeName));
    candidates.add(path.join(localAppData, "Programs", "Python", "Python313", "Scripts", exeName));
    // User scripts path for pip --user installs on Windows
    candidates.add(path.join(localAppData, "Programs", "Python", "Python", "Scripts", exeName));
    candidates.add(path.join(process.env.APPDATA || path.join(homeDir, "AppData", "Roaming"), "Python", "Scripts", exeName));
    return [...candidates];
  }

  // Git Bash / MSYS style Windows path on non-win32 (e.g. /c/Users/...)
  const posixDriveRoot = getWindowsDriveRootFromPosixHome(homeDir);
  if (posixDriveRoot) {
    const base = path.posix.join(posixDriveRoot, "Users", path.posix.basename(homeDir), "AppData", "Local", "Programs", "Python");
    candidates.add(path.posix.join(base, "Python310", "Scripts", exeName));
    candidates.add(path.posix.join(base, "Python311", "Scripts", exeName));
    candidates.add(path.posix.join(base, "Python312", "Scripts", exeName));
    candidates.add(path.posix.join(base, "Python313", "Scripts", exeName));
  }

  // Common Unix user-level pip locations
  candidates.add(path.join(homeDir, ".local", "bin", exeName));
  candidates.add(path.join(homeDir, "Library", "Python", "3.10", "bin", exeName));
  candidates.add(path.join(homeDir, "Library", "Python", "3.11", "bin", exeName));
  candidates.add(path.join(homeDir, "Library", "Python", "3.12", "bin", exeName));
  return [...candidates];
}

export async function discoverVideoCaptioner(): Promise<string | undefined> {
  try {
    const userConfig = await getUserConfig();
    const customPath = userConfig.videoCaptionerExecutablePath;
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }
  } catch {
    // ignore config read failures
  }

  const exeName = os.platform() === "win32" ? "videocaptioner.exe" : "videocaptioner";
  const resourcesPath = process.env.SMM_RESOURCES_PATH;
  if (resourcesPath) {
    const bundledPath = path.join(resourcesPath, "bin", "videocaptioner", exeName);
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  }

  const projectRoot = getProjectRoot();
  const devBinPath = path.join(projectRoot, "bin", "videocaptioner", exeName);
  if (fs.existsSync(devBinPath)) {
    return devBinPath;
  }

  const installBinPath = path.join(getSmmDataDir(), "bin", "videocaptioner", exeName);
  if (fs.existsSync(installBinPath)) {
    return installBinPath;
  }

  for (const candidate of getPythonScriptsCandidatePaths(exeName)) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export interface VideoCaptionerTranscribeResult {
  success?: boolean;
  error?: string;
}

export const VIDEOCAPTIONER_ASR_ENGINES = ["bijian", "jianying", "whisper-cpp"] as const;
export type VideoCaptionerAsrEngine = (typeof VIDEOCAPTIONER_ASR_ENGINES)[number];

export const VIDEOCAPTIONER_TRANSCRIBE_FORMATS = ["srt", "ass", "txt", "json"] as const;
export type VideoCaptionerTranscribeFormat = (typeof VIDEOCAPTIONER_TRANSCRIBE_FORMATS)[number];

export const VIDEOCAPTIONER_TRANSLATORS = ["bing", "google", "llm"] as const;
export type VideoCaptionerTranslator = (typeof VIDEOCAPTIONER_TRANSLATORS)[number];

export const VIDEOCAPTIONER_SUBTITLE_LAYOUTS = [
  "target-above",
  "source-above",
  "target-only",
  "source-only",
] as const;
export type VideoCaptionerSubtitleLayout = (typeof VIDEOCAPTIONER_SUBTITLE_LAYOUTS)[number];

export interface VideoCaptionerTranslateCliOptions {
  translator: VideoCaptionerTranslator;
  /** BCP 47 target language code (e.g. zh-Hans, en, ja). */
  targetLanguage: string;
  reflect?: boolean;
  layout?: VideoCaptionerSubtitleLayout;
  llm?: {
    apiKey: string;
    apiBase?: string;
    model?: string;
  };
}

export interface VideoCaptionerTranscribeCliOptions {
  asr?: VideoCaptionerAsrEngine;
  /** ISO 639-1 code or `auto`; forwarded as `--language`. */
  language?: string;
  wordTimestamps?: boolean;
  format?: VideoCaptionerTranscribeFormat;
}

export async function transcribeWithVideoCaptioner(
  mediaPath: string,
  options?: VideoCaptionerTranscribeCliOptions
): Promise<VideoCaptionerTranscribeResult> {
  if (!mediaPath) {
    return { error: "mediaPath is required" };
  }
  if (!fs.existsSync(mediaPath)) {
    return { error: `file not found: ${mediaPath}` };
  }

  const executablePath = await discoverVideoCaptioner();
  if (!executablePath) {
    return { error: "videocaptioner executable not found" };
  }

  const env = await resolveSpawnEnvForVideoCaptioner();

  const asr: VideoCaptionerAsrEngine = options?.asr ?? "bijian";
  // CLI requires subcommand form: videocaptioner transcribe <mediaPath>
  const args = ["transcribe", mediaPath, "--asr", asr];
  if (options?.language !== undefined && options.language.trim() !== "") {
    args.push("--language", options.language.trim());
  }
  if (options?.wordTimestamps === true) {
    args.push("--word-timestamps");
  }
  const format: VideoCaptionerTranscribeFormat = options?.format ?? "srt";
  args.push("--format", format);
  const commandForLog = [executablePath, ...args]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(" ");
  try {
    videoCaptionerLog.info(
      { executablePath, mediaPath, args, command: commandForLog },
      "running videocaptioner transcribe command"
    );
    const child = spawn(executablePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...(env ? { env } : {}),
    });
    return await new Promise<VideoCaptionerTranscribeResult>((resolve) => {
      let settled = false;
      let stderrOutput = "";
      const finish = (result: VideoCaptionerTranscribeResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };

      const timeoutId = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore kill failures and surface timeout error
        }
        finish({ error: `videocaptioner timed out after ${TRANSCRIBE_TIMEOUT_MS}ms` });
      }, TRANSCRIBE_TIMEOUT_MS);

      child.once("error", (error) => {
        finish({
          error: `failed to run videocaptioner: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      });

      child.once("close", (code) => {
        if (code === 0) {
          finish({ success: true });
          return;
        }
        const trimmedStderr = stderrOutput.trim();
        const stderrSuffix = trimmedStderr ? `: ${trimmedStderr.slice(0, 500)}` : "";
        finish({ error: `videocaptioner exited with code ${code ?? "unknown"}${stderrSuffix}` });
      });

      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string | Buffer) => {
        stderrOutput += String(chunk);
      });
    });
  } catch (error) {
    videoCaptionerLog.error({ error, executablePath, mediaPath }, "failed to start videocaptioner");
    return {
      error: `failed to start videocaptioner: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export async function translateSubtitleWithVideoCaptioner(
  subtitlePath: string,
  options: VideoCaptionerTranslateCliOptions
): Promise<VideoCaptionerTranscribeResult> {
  if (!subtitlePath) {
    return { error: "subtitlePath is required" };
  }
  if (!fs.existsSync(subtitlePath)) {
    return { error: `file not found: ${subtitlePath}` };
  }

  const executablePath = await discoverVideoCaptioner();
  if (!executablePath) {
    return { error: "videocaptioner executable not found" };
  }

  const env = await resolveSpawnEnvForVideoCaptioner();

  const args = [
    "subtitle",
    subtitlePath,
    "--translator",
    options.translator,
    "--target-language",
    options.targetLanguage.trim(),
    "--no-optimize",
    "--no-split",
  ];
  if (options.reflect === true) {
    args.push("--reflect");
  }
  if (options.layout !== undefined) {
    args.push("--layout", options.layout);
  }
  if (options.translator === "llm" && options.llm) {
    args.push("--api-key", options.llm.apiKey);
    if (options.llm.apiBase?.trim()) {
      args.push("--api-base", options.llm.apiBase.trim());
    }
    if (options.llm.model?.trim()) {
      args.push("--model", options.llm.model.trim());
    }
  }

  const commandForLog = [executablePath, ...args]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(" ");
  try {
    videoCaptionerLog.info(
      { executablePath, subtitlePath, args, command: commandForLog },
      "running videocaptioner subtitle translate command"
    );
    const child = spawn(executablePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...(env ? { env } : {}),
    });
    return await new Promise<VideoCaptionerTranscribeResult>((resolve) => {
      let settled = false;
      let stderrOutput = "";
      const finish = (result: VideoCaptionerTranscribeResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };

      const timeoutId = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore kill failures and surface timeout error
        }
        finish({ error: `videocaptioner timed out after ${TRANSCRIBE_TIMEOUT_MS}ms` });
      }, TRANSCRIBE_TIMEOUT_MS);

      child.once("error", (error) => {
        finish({
          error: `failed to run videocaptioner: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      });

      child.once("close", (code) => {
        if (code === 0) {
          finish({ success: true });
          return;
        }
        const trimmedStderr = stderrOutput.trim();
        const stderrSuffix = trimmedStderr ? `: ${trimmedStderr.slice(0, 500)}` : "";
        finish({ error: `videocaptioner exited with code ${code ?? "unknown"}${stderrSuffix}` });
      });

      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string | Buffer) => {
        stderrOutput += String(chunk);
      });
    });
  } catch (error) {
    videoCaptionerLog.error({ error, executablePath, subtitlePath }, "failed to start videocaptioner");
    return {
      error: `failed to start videocaptioner: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}
