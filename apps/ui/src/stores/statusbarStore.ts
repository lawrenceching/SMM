import { create } from 'zustand'

/** App bootstrap phase — StatusBar translates this at render time. */
export type BootstrapStatus =
  | { status: 'initializing' }
  | { status: 'ready' }
  | { status: 'error'; message: string }

interface StatusbarState {
  isBackgroundJobsPopoverOpen: boolean
  setBackgroundJobsPopoverOpen: (open: boolean) => void

  bootstrap: BootstrapStatus
  setBootstrap: (bootstrap: BootstrapStatus) => void
}

export const useStatusbarStore = create<StatusbarState>()((set) => ({
  isBackgroundJobsPopoverOpen: false,
  setBackgroundJobsPopoverOpen: (open) => set({ isBackgroundJobsPopoverOpen: open }),

  bootstrap: { status: 'initializing' },
  setBootstrap: (bootstrap) => set({ bootstrap }),
}))
