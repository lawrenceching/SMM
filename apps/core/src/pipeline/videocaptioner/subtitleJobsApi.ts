export interface TranscribeSubtitleRequest {
  folder: string;
  mediaPath: string;
  title?: string;
  asr: "bijian" | "jianying" | "whisper-cpp";
  language?: string;
  wordTimestamps?: boolean;
  format?: "srt" | "ass" | "txt" | "json";
}

export interface TranslateSubtitleRequest {
  folder: string;
  subtitlePath: string;
  mediaPath?: string;
  title?: string;
  translator: "bing" | "google" | "llm";
  targetLanguage: string;
  reflect?: boolean;
  layout?: "target-above" | "source-above" | "target-only" | "source-only";
  llm?: { apiKey: string; apiBase?: string; model?: string };
}

export interface SubtitleJobHandle {
  id: string;
}

export function assertTranscribeSubtitleRequest(req: TranscribeSubtitleRequest): {
  folder: string;
  mediaPath: string;
} {
  const folder = req.folder.trim();
  const mediaPath = req.mediaPath.trim();
  if (!folder) throw new Error("folder is required");
  if (!mediaPath) throw new Error("mediaPath is required");
  if (!req.asr) throw new Error("asr is required");
  return { folder, mediaPath };
}

export function assertTranslateSubtitleRequest(req: TranslateSubtitleRequest): {
  folder: string;
  subtitlePath: string;
  targetLanguage: string;
} {
  const folder = req.folder.trim();
  const subtitlePath = req.subtitlePath.trim();
  const targetLanguage = req.targetLanguage.trim();
  if (!folder) throw new Error("folder is required");
  if (!subtitlePath) throw new Error("subtitlePath is required");
  if (!req.translator) throw new Error("translator is required");
  if (!targetLanguage) throw new Error("targetLanguage is required");
  if (req.translator === "llm" && !req.llm?.apiKey?.trim()) {
    throw new Error("llm.apiKey is required when translator is llm");
  }
  return { folder, subtitlePath, targetLanguage };
}
