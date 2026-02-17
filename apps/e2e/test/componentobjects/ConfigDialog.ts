/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

class ConfigDialog {
    /**
     * Get the config dialog element
     */
    get dialog() {
        return $('[data-testid="config-dialog"]')
    }

    /**
     * Get the close button in the dialog
     */
    get closeButton() {
        // The close button is typically rendered by the DialogContent component
        return $('[data-testid="config-dialog"] button[aria-label="Close"]')
    }

    /**
     * Check if the config dialog is displayed
     */
    async isDisplayed(): Promise<boolean> {
        try {
            const dialog = await this.dialog
            return await dialog.isDisplayed()
        } catch {
            return false
        }
    }

    /**
     * Wait for the config dialog to be displayed
     * @param timeout Timeout in milliseconds (default: 5000)
     */
    async waitForDisplayed(timeout: number = 5000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return await this.isDisplayed()
        }, {
            timeout,
            timeoutMsg: `Config dialog was not displayed after ${timeout}ms`
        })
    }

    /**
     * Wait for the config dialog to be closed
     * @param timeout Timeout in milliseconds (default: 5000)
     */
    async waitForClosed(timeout: number = 5000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return !(await this.isDisplayed())
        }, {
            timeout,
            timeoutMsg: `Config dialog was not closed after ${timeout}ms`
        })
    }

    /**
     * Close the dialog by clicking the close button
     */
    async close(): Promise<void> {
        // Try to find and click the close button
        // The close button might have different selectors depending on the dialog implementation
        try {
            // Try to click the close button with aria-label="Close"
            const closeBtn = await this.closeButton
            if (await closeBtn.isExisting()) {
                await closeBtn.click()
                return
            }
        } catch {
            // Close button not found with aria-label
        }

        // Alternative: Press Escape key to close
        await browser.keys(['Escape'])
    }

    /**
     * Press Escape key to close the dialog
     */
    async pressEscape(): Promise<void> {
        await browser.keys(['Escape'])
    }
}

export default new ConfigDialog()
