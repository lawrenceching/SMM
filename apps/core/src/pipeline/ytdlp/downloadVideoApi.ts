import type { CommandPort } from "../../ports/CommandPort";
import type { FsPort } from "../../ports/FsPort";
import { validateDownloadUrl } from "../../download-video-validators";
import { isYoutubeDownloadUrl } from "../../download-video-cookie-platform";
import {
  buildYtdlpCookiesFilePath,
  buildYtdlpInspectArgs,
  validateYtdlpDownloadExtraArgs,
} from "../../whitelistedCmd/ytdlp";
import { parse, videoMetadataForFormatsListing } from "./parse";
import type { PlaylistMetadata, VideoMetadata } from "./types";
import { classifyYtdlpError } from "./classifyYtdlpError";
import { buildYtDlpSimulatedError, parseTestYtDlpUrl } from "./testLocal";

export interface YtdlpCommonRequest {
  cookiesText?: string;
  cookiesFromBrowser?: string;
  jsRuntime?: string;
  jsRuntimePath?: string;
  proxy?: string;
}

export interface InspectVideoRequest extends YtdlpCommonRequest {
  url: string;
}

export interface InspectVideoResult {
  video: VideoMetadata;
  playlistEntries?: VideoMetadata[];
}

export interface DownloadVideoRequest extends YtdlpCommonRequest {
  folder: string;
  url: string;
  title?: string;
  format?: string;
  extraArgs?: string[];
}

export interface DownloadVideoHandle {
  id: string;
}

export function assertValidDownloadUrl(url: string): string {
  const trimmed = url.trim();
  const validation = validateDownloadUrl(trimmed);
  if (!validation.valid) {
    throw new Error(
      validation.error === "URL_EMPTY" ? "url is required" : "url must be http or https",
    );
  }
  return trimmed;
}

export function assertYoutubeCookies(url: string, request: YtdlpCommonRequest): void {
  if (!isYoutubeDownloadUrl(url)) {
    return;
  }
  const hasText = Boolean(request.cookiesText?.trim());
  const hasBrowser = Boolean(request.cookiesFromBrowser?.trim());
  if (!hasText && !hasBrowser) {
    throw new Error("YouTube downloads require cookiesText or cookiesFromBrowser");
  }
}

export function assertDownloadVideoRequest(request: DownloadVideoRequest): {
  url: string;
  folder: string;
} {
  const url = assertValidDownloadUrl(request.url);
  assertYoutubeCookies(url, request);
  const folder = request.folder.trim();
  if (!folder) {
    throw new Error("folder is required");
  }
  const extraError = validateYtdlpDownloadExtraArgs(request.extraArgs);
  if (extraError) {
    throw new Error(extraError);
  }
  return { url, folder };
}

async function withManagedCookiesFile<T>(
  fs: FsPort,
  userDataDir: string,
  id: string,
  cookiesText: string | undefined,
  run: (cookiesFile: string | undefined) => Promise<T>,
): Promise<T> {
  const text = cookiesText?.trim();
  if (!text) {
    return run(undefined);
  }
  const path = buildYtdlpCookiesFilePath(userDataDir, id);
  const tempDir = fs.join(userDataDir, "temp");
  await fs.mkdir(tempDir);
  await fs.writeTextFile(path, text);
  try {
    return await run(path);
  } finally {
    try {
      await fs.deleteFile(path);
    } catch {
      /* best-effort cleanup */
    }
  }
}

export async function inspectVideoWithCommand(options: {
  request: InspectVideoRequest;
  command: CommandPort;
  fs: FsPort;
  userDataDir: string;
  cookiesFileId: string;
}): Promise<InspectVideoResult> {
  const url = assertValidDownloadUrl(options.request.url);
  assertYoutubeCookies(url, options.request);

  if (parseTestYtDlpUrl(url)) {
    const stderr = buildYtDlpSimulatedError(url);
    const classified = classifyYtdlpError({ stderr, stdout: "", exitCode: 1 });
    throw new Error(`${classified.type}: ${stderr}`);
  }

  return withManagedCookiesFile(
    options.fs,
    options.userDataDir,
    options.cookiesFileId,
    options.request.cookiesText,
    async (cookiesFile) => {
      const args = buildYtdlpInspectArgs({
        url,
        cookiesFile,
        cookiesFromBrowser: options.request.cookiesFromBrowser,
        jsRuntime: options.request.jsRuntime,
        jsRuntimePath: options.request.jsRuntimePath,
        proxy: options.request.proxy,
      });
      const result = await options.command.run(
        { command: "yt-dlp", args },
        new AbortController().signal,
      );
      if (result.exitCode !== 0) {
        const classified = classifyYtdlpError({
          stderr: result.stderr,
          stdout: result.stdout,
          exitCode: result.exitCode,
        });
        const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
        throw new Error(`${classified.type}: ${detail}`);
      }
      const parsed = parse(result.stdout);
      const video = videoMetadataForFormatsListing(parsed);
      let playlistEntries: VideoMetadata[] | undefined;
      if ("entries" in parsed) {
        playlistEntries = (parsed as PlaylistMetadata).entries;
      }
      return { video, playlistEntries };
    },
  );
}
