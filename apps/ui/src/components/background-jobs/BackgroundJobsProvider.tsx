import { createContext, useContext, type ReactNode } from 'react';
import type { BackgroundJob } from '@/types/background-jobs';
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore';

interface BackgroundJobsContextType {
  jobs: BackgroundJob[];
  addJob: (nameOrJob: string | BackgroundJob) => string;
  updateJob: (id: string, updates: Partial<BackgroundJob>) => void;
  abortJob: (id: string) => void;
  getRunningJobs: () => BackgroundJob[];
  isPopoverOpen: boolean;
  setPopoverOpen: (open: boolean) => void;
}

const BackgroundJobsContext = createContext<BackgroundJobsContextType | undefined>(undefined);

interface BackgroundJobsProviderProps {
  children: ReactNode;
}

/**
 * Mirrors {@link useBackgroundJobsStore} into React context for legacy callers.
 * The canonical state lives in the persisted zustand store.
 */
export function BackgroundJobsProvider({ children }: BackgroundJobsProviderProps) {
  const jobs = useBackgroundJobsStore((s) => s.jobs);
  const addJob = useBackgroundJobsStore((s) => s.addJob);
  const updateJob = useBackgroundJobsStore((s) => s.updateJob);
  const abortJob = useBackgroundJobsStore((s) => s.abortJob);
  const getRunningJobs = useBackgroundJobsStore((s) => s.getRunningJobs);
  const isPopoverOpen = useBackgroundJobsStore((s) => s.isPopoverOpen);
  const setPopoverOpen = useBackgroundJobsStore((s) => s.setPopoverOpen);

  return (
    <BackgroundJobsContext.Provider
      value={{
        jobs,
        addJob,
        updateJob,
        abortJob,
        getRunningJobs,
        isPopoverOpen,
        setPopoverOpen,
      }}
    >
      {children}
    </BackgroundJobsContext.Provider>
  );
}

/**
 * Hook to access background jobs context.
 * Returns undefined if not used within a BackgroundJobsProvider.
 */
export function useBackgroundJobs() {
  const context = useContext(BackgroundJobsContext);
  if (context === undefined) {
    throw new Error("useBackgroundJobs must be used within a BackgroundJobsProvider")
  }
  return context;
}
