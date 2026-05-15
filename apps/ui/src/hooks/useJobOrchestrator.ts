/**
 * Primary hook for consuming the JobOrchestratorProvider context.
 *
 * Re-exports the reactive hooks so callers can import everything from one place:
 *
 * ```ts
 * import { useJobOrchestrator, useFileStatuses, useJobIndicatorState } from '@/hooks/useJobOrchestrator'
 * ```
 */
export {
  useJobOrchestratorContext as useJobOrchestrator,
  useFileStatuses,
  useJobIndicatorState,
  useJobs,
  type JobOrchestratorContextValue,
  type StartJobResult,
} from '@/components/JobOrchestratorProvider'
