import { create } from 'zustand'
import { useStatusbarStore } from '@/stores/statusbarStore'

export interface FailedCommandLogEntry {
  executionId: string
  /** Display title shown in the popover. */
  title: string
  /** CLI command that was executed (ffmpeg, ffprobe). */
  command: string
  /** Error summary. */
  error: string
  /** When the failure occurred. */
  timestamp: number
}

const MAX_ENTRIES = 50

interface FailedCommandLogsState {
  entries: FailedCommandLogEntry[]
  addEntry: (entry: FailedCommandLogEntry) => void
  removeEntry: (executionId: string) => void
  clearAll: () => void
}

export const useFailedCommandLogsStore = create<FailedCommandLogsState>()((set) => ({
  entries: [],

  addEntry: (entry) => {
    set((state) => {
      // Avoid duplicates by executionId
      const exists = state.entries.some((e) => e.executionId === entry.executionId)
      if (exists) return state

      const next = [entry, ...state.entries].slice(0, MAX_ENTRIES)
      return { entries: next }
    })
    // Open the popover to draw attention
    useStatusbarStore.getState().setBackgroundJobsPopoverOpen(true)
  },

  removeEntry: (executionId) => {
    set((state) => ({
      entries: state.entries.filter((e) => e.executionId !== executionId),
    }))
  },

  clearAll: () => {
    set({ entries: [] })
  },
}))
