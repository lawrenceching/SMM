import { create } from 'zustand'

interface StatusbarState {
  isBackgroundJobsPopoverOpen: boolean
  setBackgroundJobsPopoverOpen: (open: boolean) => void
}

export const useStatusbarStore = create<StatusbarState>()((set) => ({
  isBackgroundJobsPopoverOpen: false,
  setBackgroundJobsPopoverOpen: (open) => set({ isBackgroundJobsPopoverOpen: open }),
}))
