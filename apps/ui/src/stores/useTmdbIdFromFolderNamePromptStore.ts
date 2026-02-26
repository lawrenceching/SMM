import { create } from 'zustand'
import type { TMDBTVShow } from '@core/types'

interface UseTmdbIdFromFolderNamePromptState {
  isOpen: boolean
  tmdbId: number | undefined
  mediaName: string | undefined
  status: 'ready' | 'loading' | 'error' | undefined
  onConfirm: ((tmdbTvShow: TMDBTVShow) => void) | undefined
  onCancel: (() => void) | undefined
  openPrompt: (config: {
    tmdbId: number
    mediaName?: string
    status: 'ready' | 'loading' | 'error'
    onConfirm?: (tmdbTvShow: TMDBTVShow) => void
    onCancel?: () => void
  }) => void
  updateStatus: (status: 'ready' | 'loading' | 'error', mediaName?: string) => void
  closePrompt: () => void
}

export const useTmdbIdFromFolderNamePromptStore = create<UseTmdbIdFromFolderNamePromptState>((set) => ({
  isOpen: false,
  tmdbId: undefined,
  mediaName: undefined,
  status: undefined,
  onConfirm: undefined,
  onCancel: undefined,

  openPrompt: (config) => {
    set({
      isOpen: true,
      tmdbId: config.tmdbId,
      mediaName: config.mediaName,
      status: config.status,
      onConfirm: config.onConfirm,
      onCancel: config.onCancel,
    })
  },

  updateStatus: (status, mediaName) => {
    set((state) => ({
      status,
      mediaName: mediaName !== undefined ? mediaName : state.mediaName,
    }))
  },

  closePrompt: () => {
    set({
      isOpen: false,
      tmdbId: undefined,
      mediaName: undefined,
      status: undefined,
      onConfirm: undefined,
      onCancel: undefined,
    })
  },
}))
