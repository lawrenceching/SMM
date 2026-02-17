/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

// Key constants for keyboard simulation
const Key = {
    Ctrl: '\uE009',
    Backspace: '\uE003',
    Enter: '\uE007',
    Escape: '\uE00C'
}

class RenameDialog {
    /**
     * Get the rename dialog element
     */
    get dialog() {
        return $('[data-testid="rename-dialog"]')
    }

    /**
     * Get the rename dialog input field
     */
    get input() {
        return $('[data-testid="rename-dialog-input"]')
    }

    /**
     * Get the confirm button
     */
    get confirmButton() {
        return $('[data-testid="rename-dialog-confirm"]')
    }

    /**
     * Get the cancel button
     */
    get cancelButton() {
        return $('[data-testid="rename-dialog-cancel"]')
    }

    /**
     * Get the suggestions container
     */
    get suggestionsContainer() {
        return $('[data-testid="rename-dialog-suggestions"]')
    }

    /**
     * Check if the rename dialog is displayed
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
     * Wait for the rename dialog to be displayed
     * @param timeout Timeout in milliseconds (default: 5000)
     */
    async waitForDisplayed(timeout: number = 5000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return await this.isDisplayed()
        }, {
            timeout,
            timeoutMsg: `Rename dialog was not displayed after ${timeout}ms`
        })
    }

    /**
     * Wait for the rename dialog to be closed
     * @param timeout Timeout in milliseconds (default: 5000)
     */
    async waitForClosed(timeout: number = 5000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return !(await this.isDisplayed())
        }, {
            timeout,
            timeoutMsg: `Rename dialog was not closed after ${timeout}ms`
        })
    }

    /**
     * Get the current value in the input field
     */
    async getInputValue(): Promise<string> {
        const inputElement = await this.input
        return await inputElement.getValue()
    }

    /**
     * Set the value in the input field
     * Clears existing text and types the new value
     * @param value The new value to enter
     */
    async setInputValue(value: string): Promise<void> {
        const inputElement = await this.input
        await inputElement.waitForExist({ timeout: 5000 })
        await inputElement.click()

        // Select all and delete
        await browser.keys([Key.Ctrl, 'a'])
        await browser.keys([Key.Backspace])

        // Small delay to let React process the change
        await browser.pause(100)

        // Type the new value
        if (value.length > 0) {
            await browser.keys(value)
        }
    }

    /**
     * Clear the input field
     */
    async clearInput(): Promise<void> {
        const inputElement = await this.input
        await inputElement.waitForExist({ timeout: 5000 })
        await inputElement.click()

        await browser.keys([Key.Ctrl, 'a'])
        await browser.keys([Key.Backspace])
    }

    /**
     * Click the confirm button
     */
    async clickConfirm(): Promise<void> {
        const button = await this.confirmButton
        await button.waitForClickable({ timeout: 5000 })
        await button.click()
    }

    /**
     * Click the cancel button
     */
    async clickCancel(): Promise<void> {
        const button = await this.cancelButton
        await button.waitForClickable({ timeout: 5000 })
        await button.click()
    }

    /**
     * Press Enter key to confirm (keyboard shortcut)
     */
    async pressEnter(): Promise<void> {
        await browser.keys([Key.Enter])
    }

    /**
     * Press Escape key to cancel (keyboard shortcut)
     */
    async pressEscape(): Promise<void> {
        await browser.keys([Key.Escape])
    }

    /**
     * Check if the confirm button is disabled
     */
    async isConfirmDisabled(): Promise<boolean> {
        const button = await this.confirmButton
        return await button.getAttribute('disabled') !== null
    }

    /**
     * Check if suggestions are displayed
     */
    async hasSuggestions(): Promise<boolean> {
        try {
            const container = await this.suggestionsContainer
            return await container.isExisting()
        } catch {
            return false
        }
    }

    /**
     * Get the number of suggestions displayed
     */
    async getSuggestionCount(): Promise<number> {
        const suggestions = await $$('[data-testid^="rename-dialog-suggestion-"]')
        return suggestions.length
    }

    /**
     * Click on a suggestion by index
     * @param index The index of the suggestion to click (0-based)
     */
    async clickSuggestion(index: number): Promise<void> {
        const suggestion = $(`[data-testid="rename-dialog-suggestion-${index}"]`)
        await suggestion.waitForClickable({ timeout: 5000 })
        await suggestion.click()
    }

    /**
     * Get the text of a suggestion by index
     * @param index The index of the suggestion (0-based)
     */
    async getSuggestionText(index: number): Promise<string> {
        const suggestion = $(`[data-testid="rename-dialog-suggestion-${index}"]`)
        await suggestion.waitForExist({ timeout: 5000 })
        return await suggestion.getText()
    }

    /**
     * Complete the rename operation by entering a new name and confirming
     * @param newName The new name to enter
     */
    async rename(newName: string): Promise<void> {
        await this.waitForDisplayed()
        await this.setInputValue(newName)
        await this.clickConfirm()
        await this.waitForClosed()
    }
}

export default new RenameDialog()
