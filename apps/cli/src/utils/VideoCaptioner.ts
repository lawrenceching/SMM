import { getUserConfig } from "./config";
import path from "path";
import os from "os";
import fs from "fs";
import { spawn } from "child_process";
import { logger } from "../../lib/logger";
import { createCommandExecutionLogWriter } from "../route/commandExecutionLog";
import { isCommandExecutionId } from "../route/commandLog";
import { discoverFfmpeg } from "./Ffmpeg";

const videoCaptionerLog = logger.child({ module: "videocaptioner" });
export const TRANSCRIBE_TIMEOUT_MS = 10 * 60 * 1000;
/** Subtitle mux/burn can exceed transcribe duration. */
export const SYNTHESIZE_TIMEOUT_MS = 60 * 60 * 1000;

/** Full `videocaptioner process` (transcribe → subtitle → optional synthesize) can run much longer. */
export const PROCESS_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * videocaptioner CLI incorrectly requires `--api-key` even when the operation does not use an LLM.
 * Pass this placeholder so validation succeeds; real `--api-key` from LLM flows is preserved (not duplicated).
 */
export const VIDEOCAPTIONER_CLI_DUMMY_API_KEY = "dummykey";

function ensureVideoCaptionerCliDummyApiKey(args: string[]): void {
  if (!args.includes("--api-key")) {
    args.push("--api-key", VIDEOCAPTIONER_CLI_DUMMY_API_KEY);
  }
}

export async function resolveSpawnEnvForVideoCaptioner(): Promise<NodeJS.ProcessEnv | undefined> {
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
  /** Present when a command execution log was created for this run. */
  executionId?: string;
  /** Relative to application log root (POSIX), e.g. `commands/<id>/main.log`. */
  logRelativePath?: string;
}

type VideocaptionerSpawnLogMeta = {
  op: string;
  mediaPath?: string;
  subtitlePath?: string;
  videoPath?: string;
  onNonZeroExit?: (ctx: {
    code: number | null;
    trimmedStderr: string;
  }) => void;
};

async function runVideocaptionerSpawnWithCommandLog(input: {
  executablePath: string;
  args: string[];
  env: NodeJS.ProcessEnv | undefined;
  timeoutMs: number;
  logMeta: VideocaptionerSpawnLogMeta;
  /** When set and valid UUID v4, used as command log directory id (must be validated by caller). */
  executionId?: string;
}): Promise<VideoCaptionerTranscribeResult> {
  const writerId =
    input.executionId !== undefined && isCommandExecutionId(input.executionId)
      ? input.executionId.trim()
      : undefined;
  const cmdLog = await createCommandExecutionLogWriter(writerId);
  const correlation: Pick<VideoCaptionerTranscribeResult, "executionId" | "logRelativePath"> = {
    executionId: cmdLog.executionId,
    logRelativePath: cmdLog.logRelativePath,
  };

  const commandForLog = [input.executablePath, ...input.args]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(" ");

  cmdLog.appendSystemNote(
    JSON.stringify({
      tool: "videocaptioner",
      commandLine: commandForLog,
      ...input.logMeta,
    }),
  );

  let cmdLogEnded = false;
  const safeEndCmdLog = (note?: string) => {
    if (cmdLogEnded) return;
    cmdLogEnded = true;
    if (note) {
      cmdLog.appendSystemNote(note);
    }
    cmdLog.close();
  };

  const merge = (result: VideoCaptionerTranscribeResult): VideoCaptionerTranscribeResult => ({
    ...result,
    ...correlation,
  });

  try {
    const child = spawn(input.executablePath, input.args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...(input.env ? { env: input.env } : {}),
    });

    return await new Promise<VideoCaptionerTranscribeResult>((resolve) => {
      let settled = false;
      let stderrOutput = "";
      const finish = (result: VideoCaptionerTranscribeResult, logNote?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        safeEndCmdLog(logNote);
        resolve(merge(result));
      };

      const timeoutId = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore kill failures and surface timeout error
        }
        finish(
          { error: `videocaptioner timed out after ${input.timeoutMs}ms` },
          `timeout after ${input.timeoutMs}ms`,
        );
      }, input.timeoutMs);

      child.once("error", (error) => {
        finish(
          {
            error: `failed to run videocaptioner: ${error instanceof Error ? error.message : "unknown error"}`,
          },
          `process error: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      });

      child.once("close", (code) => {
        if (code === 0) {
          finish({ success: true }, `exit code=${code}`);
          return;
        }
        const trimmedStderr = stderrOutput.trim();
        input.logMeta.onNonZeroExit?.({ code, trimmedStderr });
        const stderrSuffix = trimmedStderr ? `: ${trimmedStderr.slice(0, 500)}` : "";
        finish(
          { error: `videocaptioner exited with code ${code ?? "unknown"}${stderrSuffix}` },
          `exit code=${code ?? "null"}`,
        );
      });

      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string | Buffer) => {
        cmdLog.appendStdout(chunk);
      });

      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string | Buffer) => {
        cmdLog.appendStderr(chunk);
        stderrOutput += String(chunk);
      });
    });
  } catch (error) {
    safeEndCmdLog(`spawn failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return merge({
      error: `failed to start videocaptioner: ${error instanceof Error ? error.message : "unknown error"}`,
    });
  }
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

export const VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES = ["soft", "hard"] as const;
export type VideoCaptionerSynthesizeSubtitleMode = (typeof VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES)[number];

export const VIDEOCAPTIONER_SYNTHESIZE_QUALITY = ["ultra", "high", "medium", "low"] as const;
export type VideoCaptionerSynthesizeQuality = (typeof VIDEOCAPTIONER_SYNTHESIZE_QUALITY)[number];

export const VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES = ["ass", "rounded"] as const;
export type VideoCaptionerSynthesizeRenderMode = (typeof VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES)[number];

export interface VideoCaptionerSynthesizeCliOptions {
  subtitleMode?: VideoCaptionerSynthesizeSubtitleMode;
  quality?: VideoCaptionerSynthesizeQuality;
  /** Preset style name (e.g. `anime`). */
  style?: string;
  renderMode?: VideoCaptionerSynthesizeRenderMode;
  layout?: VideoCaptionerSubtitleLayout;
}

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

/** Options for `videocaptioner process` (combines transcribe, subtitle, and synthesize flags). */
export interface VideoCaptionerProcessCliOptions {
  transcribe?: VideoCaptionerTranscribeCliOptions;
  noOptimize?: boolean;
  noTranslate?: boolean;
  noSplit?: boolean;
  translator?: VideoCaptionerTranslator;
  targetLanguage?: string;
  reflect?: boolean;
  /** Subtitle bilingual layout (`subtitle --layout`). */
  layout?: VideoCaptionerSubtitleLayout;
  prompt?: string;
  llm?: {
    apiKey: string;
    apiBase?: string;
    model?: string;
  };
  noSynthesize?: boolean;
  synthesize?: VideoCaptionerSynthesizeCliOptions;
}

export async function transcribeWithVideoCaptioner(
  mediaPath: string,
  options?: VideoCaptionerTranscribeCliOptions,
  executionId?: string,
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
  ensureVideoCaptionerCliDummyApiKey(args);
  const commandForLog = [executablePath, ...args]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(" ");
  videoCaptionerLog.info(
    { executablePath, mediaPath, args, command: commandForLog },
    "running videocaptioner transcribe command",
  );
  return runVideocaptionerSpawnWithCommandLog({
    executablePath,
    args,
    env,
    timeoutMs: TRANSCRIBE_TIMEOUT_MS,
    logMeta: { op: "transcribe", mediaPath },
    ...(executionId !== undefined ? { executionId } : {}),
  });
}

export async function translateSubtitleWithVideoCaptioner(
  subtitlePath: string,
  options: VideoCaptionerTranslateCliOptions,
  executionId?: string,
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

  ensureVideoCaptionerCliDummyApiKey(args);

  const commandForLog = [executablePath, ...args]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(" ");
  videoCaptionerLog.info(
    { executablePath, subtitlePath, args, command: commandForLog },
    "running videocaptioner subtitle translate command",
  );
  return runVideocaptionerSpawnWithCommandLog({
    executablePath,
    args,
    env,
    timeoutMs: TRANSCRIBE_TIMEOUT_MS,
    logMeta: { op: "translate", subtitlePath },
    ...(executionId !== undefined ? { executionId } : {}),
  });
}

export async function synthesizeWithVideoCaptioner(
  videoPath: string,
  subtitlePath: string,
  options?: VideoCaptionerSynthesizeCliOptions,
  executionId?: string,
): Promise<VideoCaptionerTranscribeResult> {
  if (!videoPath) {
    return { error: "videoPath is required" };
  }
  if (!subtitlePath) {
    return { error: "subtitlePath is required" };
  }
  if (!fs.existsSync(videoPath)) {
    return { error: `file not found: ${videoPath}` };
  }
  if (!fs.existsSync(subtitlePath)) {
    return { error: `file not found: ${subtitlePath}` };
  }

  const executablePath = await discoverVideoCaptioner();
  if (!executablePath) {
    return { error: "videocaptioner executable not found" };
  }

  const env = await resolveSpawnEnvForVideoCaptioner();

  const args = ["synthesize", videoPath, "-s", subtitlePath];
  if (options?.subtitleMode !== undefined) {
    args.push("--subtitle-mode", options.subtitleMode);
  }
  if (options?.quality !== undefined) {
    args.push("--quality", options.quality);
  }
  if (options?.style?.trim()) {
    args.push("--style", options.style.trim());
  }
  if (options?.renderMode !== undefined) {
    args.push("--render-mode", options.renderMode);
  }
  if (options?.layout !== undefined) {
    args.push("--layout", options.layout);
  }

  ensureVideoCaptionerCliDummyApiKey(args);

  const commandForLog = [executablePath, ...args]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(" ");
  videoCaptionerLog.info(
    { executablePath, videoPath, subtitlePath, args, command: commandForLog },
    "running videocaptioner synthesize command",
  );
  return runVideocaptionerSpawnWithCommandLog({
    executablePath,
    args,
    env,
    timeoutMs: SYNTHESIZE_TIMEOUT_MS,
    logMeta: {
      op: "synthesize",
      videoPath,
      subtitlePath,
      onNonZeroExit: ({ code, trimmedStderr }) => {
        videoCaptionerLog.warn(
          {
            exitCode: code,
            stderr: trimmedStderr.slice(0, 4000),
            stderrTruncated: trimmedStderr.length > 4000,
            videoPath,
            subtitlePath,
          },
          "videocaptioner synthesize exited with non-zero code",
        );
      },
    },
    ...(executionId !== undefined ? { executionId } : {}),
  });
}

/** argv for `videocaptioner` executable (subcommand `process` + flags), same contract as POST `/api/executeCmd` with `command: "videocaptioner"`. */
export function buildProcessVideoCaptionerArgs(
  mediaPath: string,
  options?: VideoCaptionerProcessCliOptions,
): string[] {
  const args: string[] = ["process", mediaPath];

  const tr = options?.transcribe;
  const asr: VideoCaptionerAsrEngine = tr?.asr ?? "bijian";
  args.push("--asr", asr);
  if (tr?.language !== undefined && tr.language.trim() !== "") {
    args.push("--language", tr.language.trim());
  }
  if (tr?.wordTimestamps === true) {
    args.push("--word-timestamps");
  }
  const format: VideoCaptionerTranscribeFormat = tr?.format ?? "srt";
  args.push("--format", format);

  if (options?.noOptimize === true) {
    args.push("--no-optimize");
  }
  if (options?.noSplit === true) {
    args.push("--no-split");
  }
  if (options?.noTranslate === true) {
    args.push("--no-translate");
  } else if (options?.translator !== undefined && options.targetLanguage?.trim()) {
    args.push("--translator", options.translator);
    args.push("--target-language", options.targetLanguage.trim());
    if (options.reflect === true) {
      args.push("--reflect");
    }
    if (options.layout !== undefined) {
      args.push("--layout", options.layout);
    }
    if (options.prompt?.trim()) {
      args.push("--prompt", options.prompt.trim());
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
  }

  if (options?.noSynthesize === true) {
    args.push("--no-synthesize");
  } else if (options?.synthesize) {
    const syn = options.synthesize;
    if (syn.subtitleMode !== undefined) {
      args.push("--subtitle-mode", syn.subtitleMode);
    }
    if (syn.quality !== undefined) {
      args.push("--quality", syn.quality);
    }
    if (syn.style?.trim()) {
      args.push("--style", syn.style.trim());
    }
    if (syn.renderMode !== undefined) {
      args.push("--render-mode", syn.renderMode);
    }
    if (syn.layout !== undefined) {
      args.push("--layout", syn.layout);
    }
  }

  ensureVideoCaptionerCliDummyApiKey(args);
  return args;
}

export async function processWithVideoCaptioner(
  mediaPath: string,
  options?: VideoCaptionerProcessCliOptions,
  executionId?: string,
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

  const args = buildProcessVideoCaptionerArgs(mediaPath, options);

  const commandForLog = [executablePath, ...args]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(" ");
  videoCaptionerLog.info(
    { executablePath, mediaPath, args, command: commandForLog },
    "running videocaptioner process command",
  );
  return runVideocaptionerSpawnWithCommandLog({
    executablePath,
    args,
    env,
    timeoutMs: PROCESS_TIMEOUT_MS,
    logMeta: {
      op: "process",
      mediaPath,
      onNonZeroExit: ({ code, trimmedStderr }) => {
        videoCaptionerLog.warn(
          {
            exitCode: code,
            stderr: trimmedStderr.slice(0, 4000),
            stderrTruncated: trimmedStderr.length > 4000,
            mediaPath,
          },
          "videocaptioner process exited with non-zero code",
        );
      },
    },
    ...(executionId !== undefined ? { executionId } : {}),
  });
}
