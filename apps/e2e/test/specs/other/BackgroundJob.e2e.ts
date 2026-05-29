import { expect } from '@wdio/globals'
import { browser } from '@wdio/globals'
import StatusBar from '../../componentobjects/StatusBar'
import { cleanup, setup } from "test/lib/testbed"
import { delay } from 'es-toolkit'

const JOB_DELAY_MS = 5000
const JOB_NAME = 'E2E 测试任务'

describe('Background Job', () => {

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
        })
    })
  
    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
        })
    })

    it('create, abort and remove job', async function() {
        // Step 1: Trigger FixedDelayBackgroundJob event
        const script = `
            document.dispatchEvent(new CustomEvent('ui.fixedDelayBackgroundJob', {
                detail: { delay: ${JOB_DELAY_MS}, name: '${JOB_NAME}', traceId: 'e2eTest:BackgroundJob' }
            }))
        `
        await browser.executeScript(script, [])
        console.log(`Execute script: ${script}`)

        // Step 2: Wait for the job to be created (the popover auto-opens via the event handler)
        await delay(1000)

        // Step 3: Verify the background jobs indicator is displayed
        const isIndicatorDisplayed = await StatusBar.isBackgroundJobsIndicatorDisplayed()
        expect(isIndicatorDisplayed).toBe(true)

        // Step 4: Wait for the popover to appear (auto-opened by the event handler)
        let isPopoverOpen = await StatusBar.waitForBackgroundJobsPopover(5000)
        expect(isPopoverOpen).toBe(true)

        // Step 5: Verify popover title
        const popoverTitle = await StatusBar.getBackgroundJobsPopoverTitle()
        expect(popoverTitle).toBe('Background Jobs')

        // Step 6: Verify job counts
        const counts = await StatusBar.getBackgroundJobsCounts()
        expect(counts.running).toBe(1)

        // Step 7: Find our specific job by name and extract the jobId from its data-testid
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

        // Step 8: Get the job item element using exact testid match (parent div only)
        const jobItem = $(`[data-testid="background-job-${jobId}"]`)

        // Step 9: Abort the running job
        await StatusBar.abortBackgroundJob(jobId!)

        // Step 10: Wait for the abort button to disappear (status changed from 'running')
        await browser.waitUntil(async () => {
            const abortBtn = StatusBar.backgroundJobAbortButton(jobId!)
            return !(await abortBtn.isExisting())
        }, {
            timeout: 5000,
            timeoutMsg: 'Job was not aborted within 5s',
        })

        // Step 11: Verify the status badge shows 'aborted'
        const badgeText = await StatusBar.backgroundJobStatusBadge(jobId!).getText()
        expect(badgeText).toBe('aborted')

        // Step 12: Right-click on the job item to open the context menu
        await jobItem.click({ button: 'right' })

        // Step 13: Wait for the delete menu item and click it
        const deleteMenu = $(`[data-testid="background-job-${jobId}-delete-menu"]`)
        await deleteMenu.waitForExist({ timeout: 3000 })
        await deleteMenu.click()

        // Step 14: Wait for our specific job element to be removed from the DOM
        await browser.waitUntil(async () => {
            return !(await $(`[data-testid="background-job-${jobId}"]`).isExisting())
        }, {
            timeout: 5000,
            timeoutMsg: 'Job was not removed from UI within 5s',
        })

        // Step 15: Verify the job record is deleted from IndexedDB
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

    it('shows failure toast and remove', async function() {
        const FAIL_JOB_NAME = 'E2E 测试失败任务'
        const FAIL_JOB_DELAY_MS = 1000

        // Step 1: Trigger FixedDelayBackgroundJob with outcome='failed' and short delay
        const script = `
            document.dispatchEvent(new CustomEvent('ui.fixedDelayBackgroundJob', {
                detail: { delay: ${FAIL_JOB_DELAY_MS}, name: '${FAIL_JOB_NAME}', outcome: 'failed', traceId: 'e2eTest:BackgroundJob-Fail' }
            }))
        `
        await browser.executeScript(script, [])
        console.log(`Execute script: ${script}`)

        // Step 2: Wait for job to be created
        await delay(1000)

        // Step 3: Verify popover is open
        let isPopoverOpen = await StatusBar.waitForBackgroundJobsPopover(5000)
        expect(isPopoverOpen).toBe(true)

        // Step 4: Find the job ID
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

        // Step 5: Wait for the job to complete (failed)
        await browser.waitUntil(async () => {
            const badgeEl = StatusBar.backgroundJobStatusBadge(jobId!)
            const text = await badgeEl.getText()
            return text === 'failed'
        }, {
            timeout: FAIL_JOB_DELAY_MS + 5000,
            timeoutMsg: 'Job did not fail within the expected time',
        })

        // Step 6: Verify a sonner error toast appeared with the job name
        const toastEl = await $('[data-sonner-toast]')
        await toastEl.waitForExist({ timeout: 3000 })

        // Wait for the toast text to appear (sonner v2 animates the toast in)
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

        // Step 7: Right-click on the job item to open the context menu
        const jobItem = $(`[data-testid="background-job-${jobId}"]`)
        await jobItem.click({ button: 'right' })

        // Step 8: Wait for the delete menu item and click it
        const deleteMenu = $(`[data-testid="background-job-${jobId}-delete-menu"]`)
        await deleteMenu.waitForExist({ timeout: 3000 })
        await deleteMenu.click()

        // Step 9: Wait for job element to be removed from DOM
        await browser.waitUntil(async () => {
            return !(await $(`[data-testid="background-job-${jobId}"]`).isExisting())
        }, {
            timeout: 5000,
            timeoutMsg: 'Job was not removed from UI within 5s',
        })

        // Step 10: Verify the job record is deleted from IndexedDB
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
