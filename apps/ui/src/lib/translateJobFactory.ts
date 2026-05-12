import { Path } from "@core/path"
import type {
  TranslateBackgroundJob,
  TranslateBackgroundJobData,
  TranslateSubtitleLayout,
  TranslateTranslator,
} from "@/types/background-jobs"

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export interface BuildTranslateJobInput {
  folder: string
  subtitlePath: string
  title: string
  translator: TranslateTranslator
  targetLanguage: string
  mediaPath?: string
  reflect?: boolean
  layout?: TranslateSubtitleLayout
  llm?: TranslateBackgroundJobData["llm"]
}

export function buildTranslateJob(input: BuildTranslateJobInput): TranslateBackgroundJob {
  const subtitlePathPosix = Path.posix(input.subtitlePath)
  const subtitlePathPlatform = Path.toPlatformPath(subtitlePathPosix)
  const name = `Translate: ${input.title.trim() || subtitlePathPosix}`
  const mediaPathPosix = input.mediaPath ? Path.posix(input.mediaPath) : undefined
  const mediaPathPlatform = mediaPathPosix ? Path.toPlatformPath(mediaPathPosix) : undefined
  const data: TranslateBackgroundJobData = {
    folder: input.folder,
    subtitlePath: subtitlePathPosix,
    subtitlePathPlatform,
    title: input.title.trim() || subtitlePathPosix,
    translator: input.translator,
    targetLanguage: input.targetLanguage.trim(),
    ...(mediaPathPosix ? { mediaPath: mediaPathPosix, mediaPathPlatform } : {}),
    ...(input.reflect ? { reflect: true as const } : {}),
    ...(input.layout !== undefined ? { layout: input.layout } : {}),
    ...(input.llm !== undefined ? { llm: input.llm } : {}),
  }

  return {
    id: newJobId(),
    name,
    status: "pending",
    progress: 0,
    type: "translate",
    data,
  }
}
