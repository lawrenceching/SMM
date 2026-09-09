import type { MediaFileTableMenuId } from "@/components/media/MediaFileTableToolbar"
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder"

const SUBTITLE_MENU_IDS: MediaFileTableMenuId[] = [
  "subtitle",
  "transcribe",
  "translate",
  "synthesize",
  "process",
]

const LOADING_FOLDER_STATUSES: UIMediaFolderStatus[] = [
  "idle",
  "pending_for_initialization",
  "initializing",
  "loading",
  "updating",
]

export function isMediaFileTableToolbarLoading(
  folderStatus: UIMediaFolderStatus | undefined,
  folderMissing: boolean,
): boolean {
  return folderMissing || (folderStatus !== undefined && LOADING_FOLDER_STATUSES.includes(folderStatus))
}

export function buildSubtitleHiddenMenuIds(showSubtitleMenu: boolean): MediaFileTableMenuId[] {
  return showSubtitleMenu ? [] : [...SUBTITLE_MENU_IDS]
}

export function buildActionDisabledMenuIds(options: {
  actionsDisabled: boolean
  scrapeBlocked: boolean
  includeRecognize: boolean
  isTranscribeAvailable: boolean
  hasTranscribeTargets: boolean
  isTranslateAvailable: boolean
  hasTranslateTargets: boolean
  isSynthesizeAvailable: boolean
  hasSynthesizeTargets: boolean
  isProcessAvailable: boolean
  hasProcessTargets: boolean
}): MediaFileTableMenuId[] {
  const disabled: MediaFileTableMenuId[] = []
  if (options.actionsDisabled) {
    if (options.includeRecognize) disabled.push("recognize")
    disabled.push("rename", "scrape", "subtitle", ...SUBTITLE_MENU_IDS.slice(1))
    return disabled
  }

  if (options.scrapeBlocked) disabled.push("scrape")
  if (!options.hasTranscribeTargets || !options.isTranscribeAvailable) disabled.push("transcribe")
  if (!options.hasTranslateTargets || !options.isTranslateAvailable) disabled.push("translate")
  if (!options.hasSynthesizeTargets || !options.isSynthesizeAvailable) disabled.push("synthesize")
  if (!options.hasProcessTargets || !options.isProcessAvailable) disabled.push("process")
  if (
    disabled.includes("transcribe") &&
    disabled.includes("translate") &&
    disabled.includes("synthesize") &&
    disabled.includes("process")
  ) {
    disabled.push("subtitle")
  }
  return disabled
}
