import StatusBar from 'test/componentobjects/StatusBar'
import {
    importMediaLibrary,
    type OnMediaLibraryImportedEventData,
} from 'test/actions/events'

const IMPORT_MEDIA_LIBRARY_JOB_NAMES = [
    'Import Media Library',
    '导入媒体库',
    '匯入媒體庫',
] as const

const JOB_SUCCEEDED_BADGES = ['succeeded', '成功'] as const

async function findImportMediaLibraryJobId(): Promise<string | null> {
    return browser.execute((jobNames: readonly string[]) => {
        const matches: Array<{ id: string; status: string }> = []
        for (const el of Array.from(document.querySelectorAll('[data-testid$="-name"]'))) {
            const testId = el.getAttribute('data-testid')
            if (!testId?.startsWith('background-job-') || !testId.endsWith('-name')) {
                continue
            }
            const name = el.textContent?.trim() ?? ''
            if (!jobNames.includes(name)) {
                continue
            }
            const id = testId.replace('background-job-', '').replace('-name', '')
            const badge = document.querySelector(
                `[data-testid="background-job-${id}-status-badge"]`,
            )
            matches.push({
                id,
                status: badge?.textContent?.trim().toLowerCase() ?? '',
            })
        }
        const running = matches.find((job) => job.status === 'running')
        if (running) {
            return running.id
        }
        const pending = matches.find((job) => job.status === 'pending')
        if (pending) {
            return pending.id
        }
        return matches.at(-1)?.id ?? null
    }, IMPORT_MEDIA_LIBRARY_JOB_NAMES)
}

/** Waits until the UI background job for import-library reaches succeeded (or throws on failed). */
export async function waitForImportMediaLibraryJob(options?: {
    timeoutMs?: number
    startTimeoutMs?: number
}): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? 5 * 60 * 1000
    const startTimeoutMs = options?.startTimeoutMs ?? 30 * 1000

    let jobId: string | null = null
    await browser.waitUntil(
        async () => {
            jobId = await findImportMediaLibraryJobId()
            return jobId !== null
        },
        {
            timeout: startTimeoutMs,
            interval: 500,
            timeoutMsg: 'Import Media Library background job did not start',
        },
    )

    await browser.waitUntil(
        async () => {
            const badge = (await StatusBar.backgroundJobStatusBadge(jobId!).getText()).trim().toLowerCase()
            if (badge === 'failed' || badge.includes('failed') || badge.includes('失败')) {
                throw new Error(`Import Media Library background job failed (status: ${badge})`)
            }
            return JOB_SUCCEEDED_BADGES.some(
                (success) => badge === success || badge.includes(success),
            )
        },
        {
            timeout: timeoutMs,
            interval: 1000,
            timeoutMsg: `Import Media Library background job did not succeed within ${timeoutMs}ms`,
        },
    )
}

/** Dispatches ui.mediaLibraryImported and waits for Core import-library to finish. */
export async function importMediaLibraryAndWait(
    data: OnMediaLibraryImportedEventData,
    options?: { timeoutMs?: number },
): Promise<void> {
    await importMediaLibrary(data)
    await waitForImportMediaLibraryJob({ timeoutMs: options?.timeoutMs })
}
