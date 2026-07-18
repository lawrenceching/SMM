import { create } from 'zustand'

interface StatusbarState {
  isBackgroundJobsPopoverOpen: boolean
  setBackgroundJobsPopoverOpen: (open: boolean) => void

  /** Non-null while the app is initializing or after initialization failed. */
  initializationMessage: string | null
  setInitializationMessage: (msg: string | null) => void
}

export const useStatusbarStore = create<StatusbarState>()((set) => ({
  isBackgroundJobsPopoverOpen: false,
  setBackgroundJobsPopoverOpen: (open) => set({ isBackgroundJobsPopoverOpen: open }),

  initializationMessage: null,
  setInitializationMessage: (msg) => set({ initializationMessage: msg }),
}))
