/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

interface WaitForDisplayOptions {
    timeout?: number
    interval?: number
    timeoutMsg?: string
}

/**
 * Wait until an element selected by `selector` is displayed.
 * Re-queries every poll so React re-render/stale element won't break waiting.
 */
export async function waitForDisplay(
    selector: string,
    options: WaitForDisplayOptions = {}
): Promise<void> {
    const {
        timeout = 10000,
        interval = 200,
        timeoutMsg = `Element "${selector}" was not displayed after ${timeout}ms`,
    } = options

    await browser.waitUntil(
        async () => {
            const element = await $(selector)
            return await element.isDisplayed().catch(() => false)
        },
        {
            timeout,
            interval,
            timeoutMsg,
        }
    )
}

