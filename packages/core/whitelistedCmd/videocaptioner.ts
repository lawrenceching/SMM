import {
  VIDEOCAPTIONER_CLI_DUMMY_API_KEY,
  type VideoCaptionerAsrEngine,
  type VideoCaptionerSynthesizeQuality,
  type VideoCaptionerSynthesizeRenderMode,
  type VideoCaptionerSynthesizeSubtitleMode,
  type VideoCaptionerSubtitleLayout,
  type VideoCaptionerTranscribeFormat,
  type VideoCaptionerTranslator,
} from "./constants";

function ensureVideoCaptionerCliDummyApiKey(args: string[]): void {
  if (!args.includes("--api-key")) {
    args.push("--api-key", VIDEOCAPTIONER_CLI_DUMMY_API_KEY);
  }
}

export interface VideoCaptionerTranscribeInput {
  mediaPath: string;
  asr?: VideoCaptionerAsrEngine;
  language?: string;
  wordTimestamps?: boolean;
  format?: VideoCaptionerTranscribeFormat;
}

export function buildVideoCaptionerTranscribeArgs(input: VideoCaptionerTranscribeInput): string[] {
  const asr: VideoCaptionerAsrEngine = input.asr ?? "bijian";
  const args = ["transcribe", input.mediaPath, "--asr", asr];
  if (input.language !== undefined && input.language.trim() !== "") {
    args.push("--language", input.language.trim());
  }
  if (input.wordTimestamps === true) {
    args.push("--word-timestamps");
  }
  const format: VideoCaptionerTranscribeFormat = input.format ?? "srt";
  args.push("--format", format);
  ensureVideoCaptionerCliDummyApiKey(args);
  return args;
}

export interface VideoCaptionerTranslateInput {
  subtitlePath: string;
  translator: VideoCaptionerTranslator;
  targetLanguage: string;
  reflect?: boolean;
  layout?: VideoCaptionerSubtitleLayout;
  llm?: { apiKey: string; apiBase?: string; model?: string };
}

export function buildVideoCaptionerTranslateArgs(input: VideoCaptionerTranslateInput): string[] {
  const args = [
    "subtitle",
    input.subtitlePath,
    "--translator",
    input.translator,
    "--target-language",
    input.targetLanguage.trim(),
    "--no-optimize",
    "--no-split",
  ];
  if (input.reflect === true) {
    args.push("--reflect");
  }
  if (input.layout !== undefined) {
    args.push("--layout", input.layout);
  }
  if (input.translator === "llm" && input.llm) {
    args.push("--api-key", input.llm.apiKey);
    if (input.llm.apiBase?.trim()) {
      args.push("--api-base", input.llm.apiBase.trim());
    }
    if (input.llm.model?.trim()) {
      args.push("--model", input.llm.model.trim());
    }
  }
  ensureVideoCaptionerCliDummyApiKey(args);
  return args;
}

export interface VideoCaptionerSynthesizeInput {
  videoPath: string;
  subtitlePath: string;
  subtitleMode?: VideoCaptionerSynthesizeSubtitleMode;
  quality?: VideoCaptionerSynthesizeQuality;
  style?: string;
  renderMode?: VideoCaptionerSynthesizeRenderMode;
  layout?: VideoCaptionerSubtitleLayout;
}

export function buildVideoCaptionerSynthesizeArgs(input: VideoCaptionerSynthesizeInput): string[] {
  const args = ["synthesize", input.videoPath, "-s", input.subtitlePath];
  if (input.subtitleMode !== undefined) {
    args.push("--subtitle-mode", input.subtitleMode);
  }
  if (input.quality !== undefined) {
    args.push("--quality", input.quality);
  }
  if (input.style?.trim()) {
    args.push("--style", input.style.trim());
  }
  if (input.renderMode !== undefined) {
    args.push("--render-mode", input.renderMode);
  }
  if (input.layout !== undefined) {
    args.push("--layout", input.layout);
  }
  ensureVideoCaptionerCliDummyApiKey(args);
  return args;
}

export interface VideoCaptionerProcessCliOptions {
  transcribe?: {
    asr?: VideoCaptionerAsrEngine;
    language?: string;
    wordTimestamps?: boolean;
    format?: VideoCaptionerTranscribeFormat;
  };
  noOptimize?: boolean;
  noTranslate?: boolean;
  noSplit?: boolean;
  translator?: VideoCaptionerTranslator;
  targetLanguage?: string;
  reflect?: boolean;
  layout?: VideoCaptionerSubtitleLayout;
  prompt?: string;
  llm?: { apiKey: string; apiBase?: string; model?: string };
  noSynthesize?: boolean;
  synthesize?: {
    subtitleMode?: VideoCaptionerSynthesizeSubtitleMode;
    quality?: VideoCaptionerSynthesizeQuality;
    style?: string;
    renderMode?: VideoCaptionerSynthesizeRenderMode;
    layout?: VideoCaptionerSubtitleLayout;
  };
}

export function buildVideoCaptionerProcessArgs(
  mediaPath: string,
  options?: VideoCaptionerProcessCliOptions
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

/** Map process job JSON fields to {@link VideoCaptionerProcessCliOptions}. */
export function processJobDataToCliOptions(data: Record<string, unknown>): VideoCaptionerProcessCliOptions {
  const transcribe =
    data.asr !== undefined ||
    data.language !== undefined ||
    data.wordTimestamps !== undefined ||
    data.format !== undefined
      ? {
          ...(data.asr !== undefined ? { asr: data.asr as VideoCaptionerAsrEngine } : {}),
          ...(data.language !== undefined ? { language: String(data.language) } : {}),
          ...(data.wordTimestamps !== undefined ? { wordTimestamps: Boolean(data.wordTimestamps) } : {}),
          ...(data.format !== undefined
            ? { format: data.format as VideoCaptionerTranscribeFormat }
            : {}),
        }
      : undefined;

  const synthesize =
    data.noSynthesize === true
      ? undefined
      : data.subtitleMode !== undefined ||
          data.quality !== undefined ||
          (typeof data.style === "string" && data.style.trim() !== "") ||
          data.renderMode !== undefined ||
          data.synthesizeLayout !== undefined
        ? {
            ...(data.subtitleMode !== undefined
              ? { subtitleMode: data.subtitleMode as VideoCaptionerSynthesizeSubtitleMode }
              : {}),
            ...(data.quality !== undefined
              ? { quality: data.quality as VideoCaptionerSynthesizeQuality }
              : {}),
            ...(typeof data.style === "string" && data.style.trim() !== ""
              ? { style: data.style.trim() }
              : {}),
            ...(data.renderMode !== undefined
              ? { renderMode: data.renderMode as VideoCaptionerSynthesizeRenderMode }
              : {}),
            ...(data.synthesizeLayout !== undefined
              ? { layout: data.synthesizeLayout as VideoCaptionerSubtitleLayout }
              : {}),
          }
        : undefined;

  return {
    ...(transcribe !== undefined ? { transcribe } : {}),
    ...(data.noOptimize === true ? { noOptimize: true as const } : {}),
    ...(data.noSplit === true ? { noSplit: true as const } : {}),
    ...(data.noTranslate === true ? { noTranslate: true as const } : {}),
    ...(data.noTranslate !== true && data.translator !== undefined
      ? {
          translator: data.translator as VideoCaptionerTranslator,
          targetLanguage: String(data.targetLanguage ?? "").trim(),
          ...(data.reflect === true ? { reflect: true as const } : {}),
          ...(data.layout !== undefined ? { layout: data.layout as VideoCaptionerSubtitleLayout } : {}),
          ...(typeof data.prompt === "string" && data.prompt.trim()
            ? { prompt: data.prompt.trim() }
            : {}),
          ...(data.translator === "llm" &&
          data.llm &&
          typeof data.llm === "object" &&
          typeof (data.llm as { apiKey?: string }).apiKey === "string"
            ? {
                llm: {
                  apiKey: (data.llm as { apiKey: string }).apiKey.trim(),
                  ...((data.llm as { apiBase?: string }).apiBase?.trim()
                    ? { apiBase: (data.llm as { apiBase: string }).apiBase.trim() }
                    : {}),
                  ...((data.llm as { model?: string }).model?.trim()
                    ? { model: (data.llm as { model: string }).model.trim() }
                    : {}),
                },
              }
            : {}),
        }
      : {}),
    ...(data.noSynthesize === true ? { noSynthesize: true as const } : {}),
    ...(synthesize !== undefined && Object.keys(synthesize).length > 0 ? { synthesize } : {}),
  };
}
