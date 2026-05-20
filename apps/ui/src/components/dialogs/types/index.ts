import type { SettingsTab } from "@/components/ui/config-panel"
import type { MediaMetadata } from "@core/types"
import type { DialogConfig, FileItem, FolderType } from "./common"

// Re-export types that were split out
export type { DialogConfig, FileItem, FolderType } from "./common"
export type { DownloadVideoDialogProps, EpisodeItem } from "./download-video"

export interface ConfirmationDialogProps {
  isOpen: boolean
  config: DialogConfig | null
  onClose: () => void
}

export interface SpinnerDialogProps {
  isOpen: boolean
  message?: string
}

export interface ConfigDialogProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: SettingsTab
}

export interface FilePickerDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (file: FileItem) => void
  title?: string
  description?: string
  hideDialogHeader?: boolean
  selectFolder?: boolean
  initialPath?: string
}

export interface MediaSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect?: (tmdbId: number) => void
}

export interface RenameFileDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (newName: string) => void | Promise<void>
  initialValue?: string
  title?: string
  description?: string
  suggestions?: string[]
}

export interface TextDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (text: string) => void
  initialValue?: string
  title?: string
  description?: string
  label?: string
}

export interface RenameFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  mediaFolderPath: string
  title?: string
  description?: string
}

export interface OpenFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: FolderType) => void
  folderPath?: string
}

export interface DeleteTrackDialogProps {
  /** File path relative to the media folder when possible. */
  displayPath: string
  onConfirm: () => void
  onCancel: () => void
}

export interface Task {
  name: string
  status: "pending" | "running" | "completed" | "failed"
  subTasks?: Task[]
}

export interface ScrapeDialogProps {
  isOpen: boolean
  onClose: () => void
  mediaMetadata?: MediaMetadata
}

/** Values passed to VideoCaptioner `transcribe --asr` from TranscribeDialog. */
export type TranscribeAsrEngine = "bijian" | "jianying" | "whisper-cpp"

/** Transcription backend chosen in TranscribeDialog. */
export type TranscribeProvider = "videoCaptioner" | "tencentAsr"

/** Subtitle/text output format for VideoCaptioner `transcribe --format`. */
export type TranscribeOutputFormat = "srt" | "ass" | "txt" | "json"

export interface TranscribeDialogConfirmPayload {
  selectedIds: string[]
  provider: TranscribeProvider
  /** Set when **VideoCaptioner** is selected. */
  videoCaptioner?: {
    asr: TranscribeAsrEngine
    language: string
    wordTimestamps: boolean
    format: TranscribeOutputFormat
  }
  /** Set when **Tencent ASR** is selected. */
  tencentAsr?: {
    baseUrl: string
    apiKey: string
  }
}

export interface TranscribeDialogRow {
  id: string
  /** POSIX absolute path (passed to transcribe API). */
  path: string
  /** Shown in the file column when set; defaults to `path`. */
  displayPath?: string
  /** Used for job labels and toasts; falls back to basename of path in TranscribeDialog. */
  title?: string
}

export interface UITranscribeDialogProps {
  isOpen: boolean
  onClose: () => void
  rows: TranscribeDialogRow[]
  /**
   * Media library folder (platform path), persisted on transcribe jobs for IndexedDB filtering.
   * Required for enqueue when using {@link TranscribeDialog}.
   */
  folder?: string
  title?: string
  description?: string
  /** When omitted, all rows are selected when the dialog opens. */
  defaultSelectedIds?: string[]
  /**
   * When true, show ASR engine selection (VideoCaptioner). When false, transcription uses the default engine (omit `asr` on API).
   */
  asrOptionsEnabled?: boolean
  /** When true, user may choose Tencent ASR (subject to **Tencent** SelectItem disabled state). */
  tencentAsrEnabled?: boolean
  /** VideoCaptioner executable discovery — disables **VideoCaptioner** provider when false. */
  videoCaptionerAvailable?: boolean
  /** Engines listed in the selector but not selectable. */
  disabledAsrEngines?: readonly TranscribeAsrEngine[]
  onConfirm?: (payload: TranscribeDialogConfirmPayload) => void | Promise<void>
}

/** Smart dialog: confirm runs transcribe via background jobs (no external onConfirm). */
export type TranscribeDialogProps = Omit<UITranscribeDialogProps, "onConfirm">

/** VideoCaptioner `subtitle --translator` values. */
export type SubtitleTranslateTranslator = "bing" | "google" | "llm"

/** VideoCaptioner `subtitle --layout` values. */
export type SubtitleTranslateLayout = "target-above" | "source-above" | "target-only" | "source-only"

/** Known i18n keys for ineligible subtitle translation rows (`components` namespace). */
export type SubtitleTranslationDisabledReasonKey = "subtitleTranslationDialog.noSubtitleFile"

export interface SubtitleTranslationDialogRow {
  id: string
  /** POSIX absolute path of source subtitle file; empty when ineligible. */
  path: string
  displayPath?: string
  title?: string
  /** POSIX absolute path of associated media file (for translate job mapping). */
  mediaPath?: string
  eligible: boolean
  /** i18n key under `components` namespace. */
  disabledReason?: SubtitleTranslationDisabledReasonKey
}

export interface SubtitleTranslationConfirmPayload {
  selectedIds: string[]
  translator: SubtitleTranslateTranslator
  targetLanguage: string
  reflect?: boolean
  layout?: SubtitleTranslateLayout
  llm?: {
    apiKey: string
    apiBase?: string
    model?: string
  }
}

export interface UISubtitleTranslationDialogProps {
  isOpen: boolean
  onClose: () => void
  rows: SubtitleTranslationDialogRow[]
  /**
   * Media library folder (platform path), persisted on translate jobs for IndexedDB filtering.
   * Required for enqueue when using {@link SubtitleTranslationDialog}.
   */
  folder?: string
  title?: string
  description?: string
  defaultSelectedIds?: string[]
  /** When false, confirm is disabled (VideoCaptioner required for translate). */
  videoCaptionerAvailable?: boolean
  onConfirm?: (payload: SubtitleTranslationConfirmPayload) => void | Promise<void>
}

export type SubtitleTranslationDialogProps = Omit<UISubtitleTranslationDialogProps, "onConfirm">

/** Known i18n keys for ineligible synthesize rows (`components` namespace). */
export type SynthesizeSubtitleDisabledReasonKey =
  | "synthesizeSubtitleDialog.noSubtitleFile"
  | "synthesizeSubtitleDialog.notVideoFile"

export interface SynthesizeSubtitleDialogRow {
  id: string
  /** POSIX absolute path of video file. */
  videoPath: string
  /** POSIX absolute path of subtitle file; empty when ineligible. */
  subtitlePath: string
  displayPath?: string
  title?: string
  eligible: boolean
  disabledReason?: SynthesizeSubtitleDisabledReasonKey
}

export type SynthesizeSubtitleMode = "soft" | "hard"
export type SynthesizeQuality = "ultra" | "high" | "medium" | "low"
export type SynthesizeRenderMode = "ass" | "rounded"
export type SynthesizeSubtitleLayoutOption =
  | "target-above"
  | "source-above"
  | "target-only"
  | "source-only"

export interface SynthesizeSubtitleConfirmPayload {
  selectedIds: string[]
  subtitleMode: SynthesizeSubtitleMode
  quality: SynthesizeQuality
  style?: string
  renderMode?: SynthesizeRenderMode
  layout?: SynthesizeSubtitleLayoutOption
}

export interface UISynthesizeSubtitleDialogProps {
  isOpen: boolean
  onClose: () => void
  rows: SynthesizeSubtitleDialogRow[]
  folder?: string
  title?: string
  description?: string
  defaultSelectedIds?: string[]
  videoCaptionerAvailable?: boolean
  onConfirm?: (payload: SynthesizeSubtitleConfirmPayload) => void | Promise<void>
}

export type SynthesizeSubtitleDialogProps = Omit<UISynthesizeSubtitleDialogProps, "onConfirm">

/** Rows for {@link UIProcessPipelineDialog} / {@link ProcessPipelineDialog}. */
export type ProcessPipelineDisabledReasonKey = "processPipelineDialog.noMediaPath"

export interface ProcessPipelineDialogRow {
  id: string
  /** POSIX absolute media path for `videocaptioner process`. */
  mediaPath: string
  displayPath?: string
  title?: string
  eligible: boolean
  disabledReason?: ProcessPipelineDisabledReasonKey
}

export interface ProcessPipelineConfirmPayload {
  selectedIds: string[]
  asr: TranscribeAsrEngine
  language: string
  wordTimestamps: boolean
  format: TranscribeOutputFormat
  noOptimize: boolean
  noTranslate: boolean
  noSplit: boolean
  translator?: SubtitleTranslateTranslator
  targetLanguage?: string
  reflect: boolean
  layout?: SubtitleTranslateLayout
  prompt?: string
  llm?: { apiKey: string; apiBase?: string; model?: string }
  noSynthesize: boolean
  subtitleMode?: SynthesizeSubtitleMode
  quality?: SynthesizeQuality
  style?: string
  renderMode?: SynthesizeRenderMode
  synthesizeLayout?: SynthesizeSubtitleLayoutOption
}

export interface UIProcessPipelineDialogProps {
  isOpen: boolean
  onClose: () => void
  rows: ProcessPipelineDialogRow[]
  folder?: string
  title?: string
  description?: string
  defaultSelectedIds?: string[]
  videoCaptionerAvailable?: boolean
  asrOptionsEnabled?: boolean
  disabledAsrEngines?: readonly TranscribeAsrEngine[]
  onConfirm?: (payload: ProcessPipelineConfirmPayload) => void | Promise<void>
}

export type ProcessPipelineDialogProps = Omit<UIProcessPipelineDialogProps, "onConfirm">

export interface TrackProperties {
  id: number
  title?: string
  artist?: string
  duration?: number
  thumbnail?: string
  addedDate?: Date
  filePath?: string
  path?: string
}

export interface FilePropertyDialogProps {
  isOpen: boolean
  onClose: () => void
  track: TrackProperties
}

export interface FormatConverterDialogProps {
  isOpen: boolean
  onClose: () => void
  track?: TrackProperties
  onOpenFilePicker?: (
    onSelect: (file: FileItem) => void,
    options?: { selectFolder?: boolean; initialPath?: string },
  ) => void
  onSelectSource?: (track: TrackProperties) => void
}

/** Options passed when opening the edit media file (tags) dialog. Path is the media file path (e.g. POSIX). */
export interface OpenEditMediaFileOptions {
  path: string
}

export interface EditMediaFileDialogProps {
  isOpen: boolean
  onClose: () => void
  /** Media file path (e.g. POSIX) to read/write tags. */
  path: string | undefined
}

export type ExecuteCmdType = "ffmpeg" | "ffprobe" | "yt-dlp" | "videocaptioner"

export interface ExecuteCmdDialogProps {
  isOpen: boolean
  onClose: () => void
  initialCommand?: ExecuteCmdType
}

export interface ExecuteCmdLogEntry {
  id: number
  timestamp: number
  type: "stdout" | "stderr" | "system"
  content: string
}

export interface AddTestBackgroundJobDialogProps {
  isOpen: boolean
  onClose: () => void
}
