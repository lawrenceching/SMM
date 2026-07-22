import { expect } from '@wdio/globals'
import { browser } from '@wdio/globals'
import StatusBar from 'test/componentobjects/StatusBar'
import { cleanup, setup } from 'test/lib/testbed'
import { delay } from 'es-toolkit'

import { testbedOs } from 'test/lib/e2e-platform'

const JOB_DELAY_MS = 5000
const JOB_NAME = 'E2E 测试任务'

/**
 * @supports local
 * @unsupported HarmonyOS
 */
describe('Background Job', () => {
    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
            os: testbedOs,
        })
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            os: testbedOs,
        })
    })

    it('create, abort and remove job', async function () {
        const script = `
            document.dispatchEvent(new CustomEvent('ui.fixedDelayBackgroundJob', {
                detail: { delay: ${JOB_DELAY_MS}, name: '${JOB_NAME}', traceId: 'e2eTest:BackgroundJob' }
            }))
        `
        await browser.executeScript(script, [])
        console.log(`Execute script: ${script}`)

        await delay(1000)

        const isIndicatorDisplayed = await StatusBar.isBackgroundJobsIndicatorDisplayed()
        expect(isIndicatorDisplayed).toBe(true)

        const isPopoverOpen = await StatusBar.waitForBackgroundJobsPopover(5000)
        expect(isPopoverOpen).toBe(true)

        const popoverTitle = await StatusBar.getBackgroundJobsPopoverTitle()
        expect(popoverTitle).toBe('Background Jobs')

        const counts = await StatusBar.getBackgroundJobsCounts()
        expect(counts.running).toBe(1)

        const jobId = await browser.execute((jobName: string) => {
            const allElements = document.querySelectorAll('[data-testid]')
            for (const el of allElements) {
                const testId = el.getAttribute('data-testid')
                if (testId && testId.endsWith('-name') && el.textContent?.trim() === jobName) {
                    return testId.replace('background-job-', '').replace('-name', '')
                }
            }
            return null
        }, JOB_NAME)
        expect(jobId).not.toBeNull()
        console.log(`Found job ID: ${jobId}`)

        const jobItem = $(`[data-testid="background-job-${jobId}"]`)

        await StatusBar.abortBackgroundJob(jobId!)

        await browser.waitUntil(async () => {
            const abortBtn = StatusBar.backgroundJobAbortButton(jobId!)
            return !(await abortBtn.isExisting())
        }, {
            timeout: 5000,
            timeoutMsg: 'Job was not aborted within 5s',
        })

        const badgeText = await StatusBar.backgroundJobStatusBadge(jobId!).getText()
        expect(badgeText).toBe('aborted')

        await jobItem.click({ button: 'right' })

        const deleteMenu = $(`[data-testid="background-job-${jobId}-delete-menu"]`)
        await deleteMenu.waitForExist({ timeout: 3000 })
        await deleteMenu.click()

        await browser.waitUntil(async () => {
            return !(await $(`[data-testid="background-job-${jobId}"]`).isExisting())
        }, {
            timeout: 5000,
            timeoutMsg: 'Job was not removed from UI within 5s',
        })

        const idbJobExists = await browser.executeAsync(
            (id: string, done: (result: boolean) => void) => {
                const request = indexedDB.open('DownloadTaskDatabase', 1)
                request.onsuccess = () => {
                    const db = request.result
                    const tx = db.transaction('jobs', 'readonly')
                    const store = tx.objectStore('jobs')
                    const req = store.get(id)
                    req.onsuccess = () => {
                        done(req.result != null)
                    }
                    req.onerror = () => done(false)
                }
                request.onerror = () => done(false)
            },
            jobId,
        )
        expect(idbJobExists).toBe(false)
    })

    it('shows failure toast and remove', async function () {
        const FAIL_JOB_NAME = 'E2E 测试失败任务'
        const FAIL_JOB_DELAY_MS = 1000

        const script = `
            document.dispatchEvent(new CustomEvent('ui.fixedDelayBackgroundJob', {
                detail: { delay: ${FAIL_JOB_DELAY_MS}, name: '${FAIL_JOB_NAME}', outcome: 'failed', traceId: 'e2eTest:BackgroundJob-Fail' }
            }))
        `
        await browser.executeScript(script, [])
        console.log(`Execute script: ${script}`)

        await delay(1000)

        const isPopoverOpen = await StatusBar.waitForBackgroundJobsPopover(5000)
        expect(isPopoverOpen).toBe(true)

        const jobId = await browser.execute((jobName: string) => {
            const allElements = document.querySelectorAll('[data-testid]')
            for (const el of allElements) {
                const testId = el.getAttribute('data-testid')
                if (testId && testId.endsWith('-name') && el.textContent?.trim() === jobName) {
                    return testId.replace('background-job-', '').replace('-name', '')
                }
            }
            return null
        }, FAIL_JOB_NAME)
        expect(jobId).not.toBeNull()
        console.log(`Found job ID: ${jobId}`)

        await browser.waitUntil(async () => {
            const badgeEl = StatusBar.backgroundJobStatusBadge(jobId!)
            const text = await badgeEl.getText()
            return text === 'failed'
        }, {
            timeout: FAIL_JOB_DELAY_MS + 5000,
            timeoutMsg: 'Job did not fail within the expected time',
        })

        const toastEl = await $('[data-sonner-toast]')
        await toastEl.waitForExist({ timeout: 3000 })

        await browser.waitUntil(async () => {
            const text = await browser.execute(() => {
                const el = document.querySelector('[data-sonner-toast]')
                return el?.textContent?.trim() || ''
            })
            return text.length > 0 && text.includes(FAIL_JOB_NAME)
        }, {
            timeout: 5000,
            timeoutMsg: 'Toast did not show the expected text within 5s',
        })

        const toastText = await browser.execute(() => {
            const el = document.querySelector('[data-sonner-toast]')
            return (el as HTMLElement | null)?.textContent?.trim() || ''
        })
        console.log(`Toast appeared with text: ${toastText}`)

        await browser.waitUntil(async () => {
            return !(await $('[data-sonner-toast]').isExisting())
        }, {
            timeout: 6000,
            timeoutMsg: 'Failure toast did not dismiss within 6s',
        })

        const popoverOpenAfterWait = await StatusBar.isBackgroundJobsPopoverOpen()
        if (!popoverOpenAfterWait) {
            await StatusBar.clickBackgroundJobsIndicator()
            await StatusBar.waitForBackgroundJobsPopover(5000)
        }

        const jobItem = $(`[data-testid="background-job-${jobId}"]`)
        await jobItem.click({ button: 'right' })

        const deleteMenu = $(`[data-testid="background-job-${jobId}-delete-menu"]`)
        await deleteMenu.waitForExist({ timeout: 3000 })
        await deleteMenu.click()

        await browser.waitUntil(async () => {
            return !(await $(`[data-testid="background-job-${jobId}"]`).isExisting())
        }, {
            timeout: 5000,
            timeoutMsg: 'Job was not removed from UI within 5s',
        })

        const idbJobExists = await browser.executeAsync(
            (id: string, done: (result: boolean) => void) => {
                const request = indexedDB.open('DownloadTaskDatabase', 1)
                request.onsuccess = () => {
                    const db = request.result
                    const tx = db.transaction('jobs', 'readonly')
                    const store = tx.objectStore('jobs')
                    const req = store.get(id)
                    req.onsuccess = () => {
                        done(req.result != null)
                    }
                    req.onerror = () => done(false)
                }
                request.onerror = () => done(false)
            },
            jobId,
        )
        expect(idbJobExists).toBe(false)
    })
})
