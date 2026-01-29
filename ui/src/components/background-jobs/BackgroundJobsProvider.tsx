import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { BackgroundJob } from '@/types/background-jobs';

interface BackgroundJobsContextType {
  jobs: BackgroundJob[];
  addJob: (name: string) => string;
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

export function BackgroundJobsProvider({ children }: BackgroundJobsProviderProps) {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const addJob = useCallback((name: string): string => {
    const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newJob: BackgroundJob = {
      id,
      name,
      status: 'pending',
      progress: 0,
    };
    setJobs((prev) => [...prev, newJob]);
    // Automatically open the background jobs popover when a new job is created
    setIsPopoverOpen(true);
    return id;
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<BackgroundJob>) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, ...updates } : job))
    );
  }, []);

  const abortJob = useCallback((id: string) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === id && job.status === 'running'
           ? { ...job, status: 'aborted' }
          : job
      )
    );
  }, []);

  const getRunningJobs = useCallback(() => {
    return jobs.filter((job) => job.status === 'running');
  }, [jobs]);

  return (
    <BackgroundJobsContext.Provider
      value={{
        jobs,
        addJob,
        updateJob,
        abortJob,
        getRunningJobs,
        isPopoverOpen,
        setPopoverOpen: setIsPopoverOpen,
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
  // Don't throw error, just return undefined to handle cases where provider is not present
  return context;
}
