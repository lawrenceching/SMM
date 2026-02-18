import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { useBackgroundJobs } from "../background-jobs/BackgroundJobsProvider";
import { UI_FixedDelayBackgroundJobEvent, type OnFixedDelayBackgroundJobEventData } from "@/types/eventTypes";

export function FixedDelayBackgroundJobHandler() {
    const backgroundJobs = useBackgroundJobs()
    const eventListener = useRef<((event: any) => void) | null>(null);

    useMount(() => {

        eventListener.current = (event) => {
            const data = event.detail as OnFixedDelayBackgroundJobEventData
            const { delay, name, traceId } = data

            const jobName = name || `延迟任务 (${delay}ms)`
            console.log(`[${traceId}] FixedDelayBackgroundJob: Creating job "${jobName}" with delay ${delay}ms`)

            // Create background job
            const jobId = backgroundJobs?.addJob(jobName)
            if (!jobId) {
                console.error(`[${traceId}] Failed to create background job`)
                return
            }

            // Update job status to running
            backgroundJobs?.updateJob(jobId, {
                status: 'running',
                progress: 0,
            })

            // Set up progress animation
            const startTime = Date.now()
            const updateProgress = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min((elapsed / delay) * 100, 90)
                backgroundJobs?.updateJob(jobId, { progress })
            }

            const progressInterval = setInterval(updateProgress, 50)

            // Set up completion
            setTimeout(() => {
                clearInterval(progressInterval)
                backgroundJobs?.updateJob(jobId, {
                    status: 'succeeded',
                    progress: 100,
                })
                console.log(`[${traceId}] FixedDelayBackgroundJob: Job "${jobName}" completed`)
            }, delay)
        };

        document.addEventListener(UI_FixedDelayBackgroundJobEvent, eventListener.current);

    })

    useUnmount(() => {

        if (eventListener.current) {
            document.removeEventListener(UI_FixedDelayBackgroundJobEvent, eventListener.current);
        }

    })

    return (
        <></>
    )
}
