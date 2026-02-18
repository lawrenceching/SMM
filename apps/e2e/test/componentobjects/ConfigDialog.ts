/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

// Key constants for keyboard simulation
const Key = {
    Backspace: '\uE003',
    Ctrl: '\uE009',
    Enter: '\uE007',
    Escape: '\uE00C'
}

type SettingsTab = 'general' | 'ai' | 'rename-rules' | 'feedback'

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
        return $('[data-testid="config-dialog"] button[aria-label="Close"]')
    }

    // ==================== Tab Navigation ====================

    /**
     * Get a tab button by tab ID
     */
    async getTabButton(tabId: SettingsTab) {
        return $(`[data-testid="config-tab-${tabId}"]`)
    }

    /**
     * Click on a settings tab
     */
    async clickTab(tabId: SettingsTab): Promise<void> {
        const tab = await this.getTabButton(tabId)
        await tab.waitForClickable({ timeout: 5000 })
        await tab.click()
    }

    // ==================== General Settings ====================

    /**
     * Get the language select trigger
     */
    get languageSelectTrigger() {
        return $('[data-testid="setting-language-trigger"]')
    }

    /**
     * Get a language option by code
     */
    async getLanguageOption(code: string) {
        return $(`[data-testid="setting-language-option-${code}"]`)
    }

    /**
     * Get the TMDB host input
     */
    get tmdbHostInput() {
        return $('[data-testid="setting-tmdb-host"]')
    }

    /**
     * Get the TMDB API key input
     */
    get tmdbApiKeyInput() {
        return $('[data-testid="setting-tmdb-api-key"]')
    }

    /**
     * Get the TMDB proxy input
     */
    get tmdbProxyInput() {
        return $('[data-testid="setting-tmdb-proxy"]')
    }

    /**
     * Get the MCP server enable checkbox
     */
    get enableMcpServerCheckbox() {
        return $('[data-testid="setting-enable-mcp-server"]')
    }

    /**
     * Get the MCP host input
     */
    get mcpHostInput() {
        return $('[data-testid="setting-mcp-host"]')
    }

    /**
     * Get the MCP port input
     */
    get mcpPortInput() {
        return $('[data-testid="setting-mcp-port"]')
    }

    // ==================== AI Settings ====================

    /**
     * Get the AI provider combobox trigger
     */
    get aiProviderTrigger() {
        return $('[data-testid="setting-ai-provider"] button')
    }

    /**
     * Get the AI base URL input
     */
    get aiBaseUrlInput() {
        return $('[data-testid="setting-ai-base-url"]')
    }

    /**
     * Get the AI API key input
     */
    get aiApiKeyInput() {
        return $('[data-testid="setting-ai-api-key"]')
    }

    /**
     * Get the AI model input
     */
    get aiModelInput() {
        return $('[data-testid="setting-ai-model"]')
    }

    // ==================== Save Button ====================

    /**
     * Get the save button
     */
    get saveButton() {
        return $('[data-testid="settings-save-button"]')
    }

    // ==================== Dialog State ====================

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
     */
    async waitForClosed(timeout: number = 5000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return !(await this.isDisplayed())
        }, {
            timeout,
            timeoutMsg: `Config dialog was not closed after ${timeout}ms`
        })
    }

    // ==================== Input Methods ====================

    /**
     * Get the value of an input field
     */
    async getInputValue(element: ChainablePromiseElement): Promise<string> {
        return await element.getValue()
    }

    /**
     * Set the value of an input field
     */
    async setInputValue(element: ChainablePromiseElement, value: string): Promise<void> {
        await element.waitForExist({ timeout: 5000 })
        await element.click()

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
     * Clear an input field
     */
    async clearInput(element: ChainablePromiseElement): Promise<void> {
        await element.waitForExist({ timeout: 5000 })
        await element.click()
        await browser.keys([Key.Ctrl, 'a'])
        await browser.keys([Key.Backspace])
    }

    // ==================== General Settings Actions ====================

    /**
     * Select a language from the dropdown
     */
    async selectLanguage(code: string): Promise<void> {
        const trigger = await this.languageSelectTrigger
        await trigger.waitForClickable({ timeout: 5000 })
        await trigger.click()

        await browser.pause(200)

        const option = await this.getLanguageOption(code)
        await option.waitForClickable({ timeout: 5000 })
        await option.click()
    }

    /**
     * Get the current language selection
     */
    async getSelectedLanguage(): Promise<string> {
        const trigger = await this.languageSelectTrigger
        return await trigger.getText()
    }

    /**
     * Set the TMDB host
     */
    async setTmdbHost(value: string): Promise<void> {
        await this.setInputValue(this.tmdbHostInput, value)
    }

    /**
     * Get the TMDB host value
     */
    async getTmdbHost(): Promise<string> {
        return await this.getInputValue(this.tmdbHostInput)
    }

    /**
     * Set the TMDB API key
     */
    async setTmdbApiKey(value: string): Promise<void> {
        await this.setInputValue(this.tmdbApiKeyInput, value)
    }

    /**
     * Get the TMDB API key value (returns masked value for password inputs)
     */
    async getTmdbApiKey(): Promise<string> {
        return await this.getInputValue(this.tmdbApiKeyInput)
    }

    /**
     * Set the TMDB proxy
     */
    async setTmdbProxy(value: string): Promise<void> {
        await this.setInputValue(this.tmdbProxyInput, value)
    }

    /**
     * Get the TMDB proxy value
     */
    async getTmdbProxy(): Promise<string> {
        return await this.getInputValue(this.tmdbProxyInput)
    }

    /**
     * Toggle the MCP server checkbox
     */
    async toggleMcpServer(checked: boolean): Promise<void> {
        const checkbox = await this.enableMcpServerCheckbox
        await checkbox.waitForExist({ timeout: 5000 })
        const currentValue = await checkbox.isSelected()
        if (currentValue !== checked) {
            await checkbox.click()
        }
    }

    /**
     * Check if MCP server is enabled
     */
    async isMcpServerEnabled(): Promise<boolean> {
        const checkbox = await this.enableMcpServerCheckbox
        return await checkbox.isSelected()
    }

    /**
     * Set the MCP host
     */
    async setMcpHost(value: string): Promise<void> {
        await this.setInputValue(this.mcpHostInput, value)
    }

    /**
     * Get the MCP host value
     */
    async getMcpHost(): Promise<string> {
        return await this.getInputValue(this.mcpHostInput)
    }

    /**
     * Set the MCP port
     */
    async setMcpPort(value: string): Promise<void> {
        await this.setInputValue(this.mcpPortInput, value)
    }

    /**
     * Get the MCP port value
     */
    async getMcpPort(): Promise<string> {
        return await this.getInputValue(this.mcpPortInput)
    }

    // ==================== AI Settings Actions ====================

    /**
     * Select an AI provider
     */
    async selectAiProvider(provider: string): Promise<void> {
        const trigger = await this.aiProviderTrigger
        await trigger.waitForClickable({ timeout: 5000 })
        await trigger.click()

        await browser.pause(200)

        // Find and click the provider option
        const option = $(`[data-testid="setting-ai-provider"] [data-value="${provider}"]`)
        await option.waitForClickable({ timeout: 5000 })
        await option.click()
    }

    /**
     * Set the AI base URL
     */
    async setAiBaseUrl(value: string): Promise<void> {
        await this.setInputValue(this.aiBaseUrlInput, value)
    }

    /**
     * Get the AI base URL value
     */
    async getAiBaseUrl(): Promise<string> {
        return await this.getInputValue(this.aiBaseUrlInput)
    }

    /**
     * Set the AI API key
     */
    async setAiApiKey(value: string): Promise<void> {
        await this.setInputValue(this.aiApiKeyInput, value)
    }

    /**
     * Get the AI API key value
     */
    async getAiApiKey(): Promise<string> {
        return await this.getInputValue(this.aiApiKeyInput)
    }

    /**
     * Set the AI model
     */
    async setAiModel(value: string): Promise<void> {
        await this.setInputValue(this.aiModelInput, value)
    }

    /**
     * Get the AI model value
     */
    async getAiModel(): Promise<string> {
        return await this.getInputValue(this.aiModelInput)
    }

    // ==================== Save & Close ====================

    /**
     * Check if the save button is displayed (visible when there are changes)
     */
    async isSaveButtonDisplayed(): Promise<boolean> {
        try {
            const button = await this.saveButton
            return await button.isDisplayed()
        } catch {
            return false
        }
    }

    /**
     * Wait for the save button to be displayed
     */
    async waitForSaveButton(timeout: number = 5000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return await this.isSaveButtonDisplayed()
        }, {
            timeout,
            timeoutMsg: `Save button was not displayed after ${timeout}ms`
        })
    }

    /**
     * Click the save button
     */
    async clickSave(): Promise<void> {
        await this.waitForSaveButton()
        const button = await this.saveButton
        await button.waitForClickable({ timeout: 5000 })
        await button.click()
        // Wait for the save to complete (save button should disappear)
        await browser.pause(500)
    }

    /**
     * Close the dialog by pressing Escape
     */
    async close(): Promise<void> {
        await browser.keys([Key.Escape])
    }

    /**
     * Press Escape key to close the dialog
     */
    async pressEscape(): Promise<void> {
        await browser.keys([Key.Escape])
    }
}

export default new ConfigDialog()
