import { Path } from "@core/path"
import type {
  SynthesizeBackgroundJob,
  SynthesizeBackgroundJobData,
  SynthesizeQuality,
  SynthesizeRenderMode,
  SynthesizeSubtitleLayout,
  SynthesizeSubtitleMode,
} from "@/types/background-jobs"

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export interface BuildSynthesizeJobInput {
  folder: string
  videoPath: string
  subtitlePath: string
  title: string
  subtitleMode?: SynthesizeSubtitleMode
  quality?: SynthesizeQuality
  style?: string
  renderMode?: SynthesizeRenderMode
  layout?: SynthesizeSubtitleLayout
}

export function buildSynthesizeJob(input: BuildSynthesizeJobInput): SynthesizeBackgroundJob {
  const videoPathPosix = Path.posix(input.videoPath)
  const videoPathPlatform = Path.toPlatformPath(videoPathPosix)
  const subtitlePathPosix = Path.posix(input.subtitlePath)
  const subtitlePathPlatform = Path.toPlatformPath(subtitlePathPosix)
  const name = `Synthesize: ${input.title.trim() || videoPathPosix}`
  const data: SynthesizeBackgroundJobData = {
    folder: input.folder,
    videoPath: videoPathPosix,
    videoPathPlatform,
    subtitlePath: subtitlePathPosix,
    subtitlePathPlatform,
    mediaPath: videoPathPosix,
    mediaPathPlatform: videoPathPlatform,
    title: input.title.trim() || videoPathPosix,
    ...(input.subtitleMode !== undefined ? { subtitleMode: input.subtitleMode } : {}),
    ...(input.quality !== undefined ? { quality: input.quality } : {}),
    ...(input.style !== undefined && input.style.trim() !== "" ? { style: input.style.trim() } : {}),
    ...(input.renderMode !== undefined ? { renderMode: input.renderMode } : {}),
    ...(input.layout !== undefined ? { layout: input.layout } : {}),
  }

  return {
    id: newJobId(),
    name,
    status: "pending",
    progress: 0,
    type: "synthesize",
    data,
  }
}
