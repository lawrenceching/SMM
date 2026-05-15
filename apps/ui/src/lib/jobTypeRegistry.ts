import { Path } from '@core/path'
import type { TFunction } from 'i18next'

type ComponentsTFunction = TFunction<'components'>

/** Everything the orchestrator needs to handle a job type generically. */
export interface JobTypeConfig {
  /** SW message prefix: `${prefix}:start`, `${prefix}:stop`, `${prefix}:remove` etc. */
  messagePrefix: string

  /** localStorage key for auto-start preference; value `'false'` disables auto-start. */
  autoStartKey: string

  /**
   * Extracts a stable file/entity path from a job's parsed data payload.
   * Used by `useFileStatuses()` to answer "is file X currently processing?"
   * Returns `''` when no path association is needed.
   */
  extractPath: (data: unknown) => string

  /** Optional lifecycle toasts for this type. */
  toasts?: {
    started?: (t: ComponentsTFunction) => string
    succeeded?: (t: ComponentsTFunction) => string
    failed?: (t: ComponentsTFunction) => string
  }
}

export const JOB_TYPE_REGISTRY: Record<string, JobTypeConfig> = {
  'download-video': {
    messagePrefix: 'download',
    autoStartKey: 'download.autoStart',
    extractPath: (data) => {
      const url = (data as Record<string, unknown> | null)?.videos
      if (Array.isArray(url) && typeof url[0]?.url === 'string') return url[0].url
      return ''
    },
  },

  'transcribe': {
    messagePrefix: 'transcribe',
    autoStartKey: 'transcribe.autoStart',
    extractPath: (data) => {
      const p = (data as Record<string, unknown> | null)?.mediaPath
      return typeof p === 'string' && p.trim() ? Path.posix(p.trim()) : ''
    },
  },

  'translate': {
    messagePrefix: 'translate',
    autoStartKey: 'translate.autoStart',
    extractPath: (data) => {
      const d = data as Record<string, unknown> | null
      const mediaPath = typeof d?.mediaPath === 'string' && d.mediaPath.trim()
        ? Path.posix(d.mediaPath.trim()) : ''
      const subtitlePath = typeof d?.subtitlePath === 'string' && d.subtitlePath.trim()
        ? Path.posix(d.subtitlePath.trim()) : ''
      return mediaPath || subtitlePath
    },
    toasts: {
      started: (t) => t('subtitleTranslationDialog.toastStart'),
      succeeded: (t) => t('subtitleTranslationDialog.toastSucceeded'),
      failed: (t) => t('subtitleTranslationDialog.toastFailed'),
    },
  },

  'synthesize': {
    messagePrefix: 'synthesize',
    autoStartKey: 'synthesize.autoStart',
    extractPath: (data) => {
      const d = data as Record<string, unknown> | null
      const mediaPath = typeof d?.mediaPath === 'string' && d.mediaPath.trim()
        ? Path.posix(d.mediaPath.trim()) : ''
      const videoPath = typeof d?.videoPath === 'string' && d.videoPath.trim()
        ? Path.posix(d.videoPath.trim()) : ''
      return mediaPath || videoPath
    },
    toasts: {
      started: (t) => t('synthesizeSubtitleDialog.toastStart'),
      succeeded: (t) => t('synthesizeSubtitleDialog.toastSucceeded'),
      failed: (t) => t('synthesizeSubtitleDialog.toastFailed'),
    },
  },

  'process': {
    messagePrefix: 'process',
    autoStartKey: 'process.autoStart',
    extractPath: (data) => {
      const p = (data as Record<string, unknown> | null)?.mediaPath
      return typeof p === 'string' && p.trim() ? Path.posix(p.trim()) : ''
    },
    toasts: {
      started: (t) => t('processPipelineDialog.toastStart'),
      succeeded: (t) => t('processPipelineDialog.toastSucceeded'),
      failed: (t) => t('processPipelineDialog.toastFailed'),
    },
  },
}

/** All registered job type keys. */
export const ALL_JOB_TYPES = Object.keys(JOB_TYPE_REGISTRY)

/**
 * Derive the full set of SW event names for a given message prefix.
 * e.g. `'download'` → `{ start: 'download:start', started: 'download:started', ... }`
 */
export function swEventNames(prefix: string) {
  return {
    start: `${prefix}:start`,
    stop: `${prefix}:stop`,
    remove: `${prefix}:remove`,
    started: `${prefix}:started`,
    succeeded: `${prefix}:succeeded`,
    failed: `${prefix}:failed`,
    stopped: `${prefix}:stopped`,
    removed: `${prefix}:removed`,
    heartbeat: `${prefix}:heartbeat`,
  }
}
