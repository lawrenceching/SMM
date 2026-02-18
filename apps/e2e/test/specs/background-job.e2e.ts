import { expect } from '@wdio/globals'
import { browser } from '@wdio/globals'
import StatusBar from '../componentobjects/StatusBar'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const JOB_DELAY_MS = 3000
const JOB_NAME = 'E2E 测试任务'

describe('Background Job', () => {

    before(createBeforeHook())

    it('should display background job indicator when job is running', async function() {
        // Trigger FixedDelayBackgroundJob event
        await browser.executeScript(`
            document.dispatchEvent(new CustomEvent('ui.fixedDelayBackgroundJob', {
                detail: { delay: ${JOB_DELAY_MS}, name: '${JOB_NAME}', traceId: 'e2eTest:BackgroundJob' }
            }))
        `, [])

        // Wait a moment for the job to be created
        await delay(500)

        // Check that background jobs indicator is displayed
        const isIndicatorDisplayed = await StatusBar.isBackgroundJobsIndicatorDisplayed()
        expect(isIndicatorDisplayed).toBe(true)

        // Get the indicator text (should show "1" for running job)
        const indicatorText = await StatusBar.getBackgroundJobsIndicatorText()
        expect(indicatorText).toBe('1')

        // Open the background jobs popover
        await StatusBar.clickBackgroundJobsIndicator()

        // Wait for popover to appear
        const isPopoverOpen = await StatusBar.waitForBackgroundJobsPopover(5000)
        expect(isPopoverOpen).toBe(true)

        // Check popover title
        const popoverTitle = await StatusBar.getBackgroundJobsPopoverTitle()
        expect(popoverTitle).toBe('Background Jobs')

        // Check job counts
        const counts = await StatusBar.getBackgroundJobsCounts()
        expect(counts.running).toBe(1)

        // Wait for job to complete
        await delay(JOB_DELAY_MS + 1000)

        // After job completes, the trigger button should NOT exist
        // because there are no running/pending jobs anymore
        const triggerExistsAfter = await browser.$(`[data-testid="background-jobs-trigger-button"]`).isExisting()
        expect(triggerExistsAfter).toBe(false)
    })
})
