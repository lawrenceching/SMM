/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

/**
 * Selectors for the transcribe dialog rendered by `TranscribeDialog` → `UITranscribeDialog`.
 */
class TranscribeDialogCO {
    get dialog() {
        return $('[data-testid="transcribe-dialog"]')
    }

    get table() {
        return $('[data-testid="transcribe-dialog-table"]')
    }

    get selectAllCheckbox() {
        return $('[data-testid="transcribe-dialog-select-all"]')
    }

    get cancelButton() {
        return $('[data-testid="transcribe-dialog-cancel"]')
    }

    get confirmButton() {
        return $('[data-testid="transcribe-dialog-confirm"]')
    }

    get asrTrigger() {
        return $('[data-testid="transcribe-dialog-asr"]')
    }

    get advancedOptionsCheckbox() {
        return $('[data-testid="transcribe-dialog-advanced-options"]')
    }

    /**
     * @param rowId Same as `TranscribeDialogRow.id` (POSIX absolute path used as row key).
     */
    row(rowId: string) {
        return $(`[data-testid="transcribe-dialog-row-${rowId}"]`)
    }

    /**
     * @param rowId Same as `TranscribeDialogRow.id`.
     */
    rowCheckbox(rowId: string) {
        return $(`[data-testid="transcribe-dialog-row-checkbox-${rowId}"]`)
    }

    async isDisplayed(): Promise<boolean> {
        try {
            const el = await this.dialog
            return await el.isDisplayed()
        } catch {
            return false
        }
    }

    async waitForDisplayed(timeout: number = 15000): Promise<boolean> {
        return await browser.waitUntil(async () => this.isDisplayed(), {
            timeout,
            timeoutMsg: `Transcribe dialog was not displayed after ${timeout}ms`,
        })
    }

    async waitForClosed(timeout: number = 15000): Promise<boolean> {
        return await browser.waitUntil(async () => !(await this.isDisplayed()), {
            timeout,
            timeoutMsg: `Transcribe dialog was not closed after ${timeout}ms`,
        })
    }

    async clickConfirm(): Promise<void> {
        const button = await this.confirmButton
        await button.waitForClickable({ timeout: 10000 })
        await button.click()
    }

    async clickCancel(): Promise<void> {
        const button = await this.cancelButton
        await button.waitForClickable({ timeout: 5000 })
        await button.click()
    }
}

export default new TranscribeDialogCO()
