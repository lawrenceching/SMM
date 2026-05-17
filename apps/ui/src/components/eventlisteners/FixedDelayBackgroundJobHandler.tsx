import { useRef } from 'react'
import { useMount, useUnmount } from 'react-use'
import { useJobOrchestratorContext } from '@/components/JobOrchestratorProvider'
import {
  buildTestDelayBackgroundJob,
  jobToTaskRecord,
  resumeAllTestDelayJobs,
  runTestDelayJob,
} from '@/lib/testDelayJobRunner'
import { useStatusbarStore } from '@/stores/statusbarStore'
import {
  UI_FixedDelayBackgroundJobEvent,
  type OnFixedDelayBackgroundJobEventData,
} from '@/types/eventTypes'

export function FixedDelayBackgroundJobHandler() {
  const { createJob } = useJobOrchestratorContext()
  const createJobRef = useRef(createJob)
  createJobRef.current = createJob
  const eventListener = useRef<((event: Event) => void) | null>(null)

  useMount(() => {
    void resumeAllTestDelayJobs()

    eventListener.current = (event) => {
      void (async () => {
        const data = (event as CustomEvent<OnFixedDelayBackgroundJobEventData>).detail
        const { delay, name, traceId, outcome = 'succeeded' } = data

        const jobName = name || `延迟任务 (${delay}ms)`
        console.log(
          `[${traceId}] FixedDelayBackgroundJob: Creating job "${jobName}" with delay ${delay}ms, outcome ${outcome}`,
        )

        const job = buildTestDelayBackgroundJob({
          name: jobName,
          delayMs: delay,
          outcome,
        })

        try {
          await createJobRef.current(job)
          useStatusbarStore.getState().setBackgroundJobsPopoverOpen(true)
          await runTestDelayJob(jobToTaskRecord(job), traceId)
        } catch (error) {
          console.error(`[${traceId}] Failed to create test delay job`, error)
        }
      })()
    }

    document.addEventListener(UI_FixedDelayBackgroundJobEvent, eventListener.current)
  })

  useUnmount(() => {
    if (eventListener.current) {
      document.removeEventListener(UI_FixedDelayBackgroundJobEvent, eventListener.current)
    }
  })

  return null
}
