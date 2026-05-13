import { Path } from "@core/path"
import type {
  ProcessBackgroundJob,
  ProcessBackgroundJobData,
  SynthesizeQuality,
  SynthesizeRenderMode,
  SynthesizeSubtitleLayout,
  SynthesizeSubtitleMode,
  TranslateSubtitleLayout,
  TranslateTranslator,
  TranscribeOutputFormat,
  TranscribeVideoCaptionerAsr,
} from "@/types/background-jobs"

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export interface BuildProcessJobInput {
  folder: string
  mediaPath: string
  title: string
  asr?: TranscribeVideoCaptionerAsr
  language?: string
  wordTimestamps?: boolean
  format?: TranscribeOutputFormat
  noOptimize?: boolean
  noTranslate?: boolean
  noSplit?: boolean
  translator?: TranslateTranslator
  targetLanguage?: string
  reflect?: boolean
  layout?: TranslateSubtitleLayout
  prompt?: string
  llm?: { apiKey: string; apiBase?: string; model?: string }
  noSynthesize?: boolean
  subtitleMode?: SynthesizeSubtitleMode
  quality?: SynthesizeQuality
  style?: string
  renderMode?: SynthesizeRenderMode
  synthesizeLayout?: SynthesizeSubtitleLayout
}

export function buildProcessJob(input: BuildProcessJobInput): ProcessBackgroundJob {
  const mediaPathPosix = Path.posix(input.mediaPath)
  const mediaPathPlatform = Path.toPlatformPath(mediaPathPosix)
  const name = `Process: ${input.title.trim() || mediaPathPosix}`
  const data: ProcessBackgroundJobData = {
    folder: input.folder,
    mediaPath: mediaPathPosix,
    mediaPathPlatform,
    title: input.title.trim() || mediaPathPosix,
    ...(input.asr !== undefined ? { asr: input.asr } : {}),
    ...(input.language !== undefined && input.language.trim() !== "" ? { language: input.language.trim() } : {}),
    ...(input.wordTimestamps === true ? { wordTimestamps: true } : {}),
    ...(input.format !== undefined ? { format: input.format } : {}),
    ...(input.noOptimize === true ? { noOptimize: true } : {}),
    ...(input.noTranslate === true ? { noTranslate: true } : {}),
    ...(input.noSplit === true ? { noSplit: true } : {}),
    ...(input.translator !== undefined ? { translator: input.translator } : {}),
    ...(input.targetLanguage !== undefined && input.targetLanguage.trim() !== ""
      ? { targetLanguage: input.targetLanguage.trim() }
      : {}),
    ...(input.reflect === true ? { reflect: true } : {}),
    ...(input.layout !== undefined ? { layout: input.layout } : {}),
    ...(input.prompt !== undefined && input.prompt.trim() !== "" ? { prompt: input.prompt.trim() } : {}),
    ...(input.llm !== undefined ? { llm: input.llm } : {}),
    ...(input.noSynthesize === true ? { noSynthesize: true } : {}),
    ...(input.subtitleMode !== undefined ? { subtitleMode: input.subtitleMode } : {}),
    ...(input.quality !== undefined ? { quality: input.quality } : {}),
    ...(input.style !== undefined && input.style.trim() !== "" ? { style: input.style.trim() } : {}),
    ...(input.renderMode !== undefined ? { renderMode: input.renderMode } : {}),
    ...(input.synthesizeLayout !== undefined ? { synthesizeLayout: input.synthesizeLayout } : {}),
  }

  return {
    id: newJobId(),
    name,
    status: "pending",
    progress: 0,
    type: "process",
    data,
  }
}
