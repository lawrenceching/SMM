export const VIDEOCAPTIONER_DUMMY_API_KEY = "dummykey";

export type TranscribeAsr = "bijian" | "jianying" | "whisper-cpp";
export type TranscribeFormat = "srt" | "ass" | "txt" | "json";
export type TranslateTranslator = "bing" | "google" | "llm";
export type TranslateLayout =
  | "target-above"
  | "source-above"
  | "target-only"
  | "source-only";

export interface BuildTranscribeSubtitleArgsInput {
  mediaPath: string;
  asr: TranscribeAsr;
  language?: string;
  wordTimestamps?: boolean;
  format?: TranscribeFormat;
}

export interface BuildTranslateSubtitleArgsInput {
  subtitlePath: string;
  translator: TranslateTranslator;
  targetLanguage: string;
  reflect?: boolean;
  layout?: TranslateLayout;
  llm?: { apiKey: string; apiBase?: string; model?: string };
}

function ensureVcApiKey(args: string[]): void {
  if (!args.includes("--api-key")) {
    args.push("--api-key", VIDEOCAPTIONER_DUMMY_API_KEY);
  }
}

export function buildTranscribeSubtitleArgs(
  input: BuildTranscribeSubtitleArgsInput,
): string[] {
  const args: string[] = ["transcribe", input.mediaPath];
  args.push("--asr", input.asr || "bijian");
  if (input.language) args.push("--language", input.language);
  if (input.wordTimestamps === true) args.push("--word-timestamps");
  args.push("--format", input.format || "srt");
  return args;
}

export function buildTranslateSubtitleArgs(
  input: BuildTranslateSubtitleArgsInput,
): string[] {
  const args: string[] = [
    "subtitle",
    input.subtitlePath,
    "--translator",
    input.translator,
    "--target-language",
    input.targetLanguage,
    "--no-optimize",
    "--no-split",
  ];
  if (input.reflect === true) args.push("--reflect");
  if (input.layout) args.push("--layout", input.layout);
  if (input.translator === "llm" && input.llm?.apiKey) {
    args.push("--api-key", input.llm.apiKey);
    if (input.llm.apiBase) args.push("--api-base", input.llm.apiBase);
    if (input.llm.model) args.push("--model", input.llm.model);
  }
  ensureVcApiKey(args);
  return args;
}
