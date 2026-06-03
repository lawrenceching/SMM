/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

// Key constants for keyboard simulation
const Key = {
    Backspace: '\uE003',
    Ctrl: '\uE009',
    Enter: '\uE007',
    Escape: '\uE00C'
}

type SettingsTab = 'general' | 'ai' | 'external-apps' | 'rename-rules' | 'feedback'
type PreferMediaLanguageCode = "__unset__" | "zh-CN" | "en-US" | "ja-JP"
type ThemeMode = "light" | "dark" | "system"

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
     * Get the theme select trigger
     */
    get themeSelectTrigger() {
        return $('[data-testid="setting-theme-trigger"]')
    }

    /**
     * Get a theme option by value
     */
    async getThemeOption(mode: ThemeMode) {
        return $(`[data-testid="setting-theme-${mode}"]`)
    }

    /**
     * Get the primary database (TMDB / TVDB) select trigger
     */
    get primaryDatabaseSelectTrigger() {
        return $('[data-testid="setting-primary-database-trigger"]')
    }

    /**
     * Get a primary database option by value
     */
    async getPrimaryDatabaseOption(db: "TMDB" | "TVDB") {
        return $(`[data-testid="setting-primary-database-option-${db}"]`)
    }

    /**
     * Get the prefer media language select trigger
     */
    get preferMediaLanguageSelectTrigger() {
        return $('[data-testid="setting-prefer-media-language-trigger"]')
    }

    /**
     * Get a prefer media language option by value
     */
    async getPreferMediaLanguageOption(code: PreferMediaLanguageCode) {
        return $(`[data-testid="setting-prefer-media-language-option-${code}"]`)
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
     * Get the TVDB host input
     */
    get tvdbHostInput() {
        return $('[data-testid="setting-tvdb-host"]')
    }

    /**
     * Get the TVDB API key input
     */
    get tvdbApiKeyInput() {
        return $('[data-testid="setting-tvdb-api-key"]')
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

    /**
     * Get yt-dlp executable path input
     */
    get ytdlpPathInput() {
        return $('[data-testid="setting-ytdlp-executable-path"]')
    }

    /**
     * Get ffmpeg executable path input
     */
    get ffmpegPathInput() {
        return $('[data-testid="setting-ffmpeg-executable-path"]')
    }

    get ytdlpPathHint() {
        return $('[data-testid="setting-ytdlp-path-hint"]')
    }

    get ytdlpVersion() {
        return $('[data-testid="setting-ytdlp-version"]')
    }

    get ffmpegPathHint() {
        return $('[data-testid="setting-ffmpeg-path-hint"]')
    }

    get ffmpegVersion() {
        return $('[data-testid="setting-ffmpeg-version"]')
    }

    // ==================== External Applications (new tab) ====================

    get externalAppsSettings() {
        return $('[data-testid="external-apps-settings"]')
    }

    get quickjsPathInput() {
        return $('[data-testid="setting-quickjs-executable-path"]')
    }

    get quickjsBrowseButton() {
        return $('[data-testid="setting-quickjs-browse"]')
    }

    get quickjsPathHint() {
        return $('[data-testid="setting-quickjs-path-hint"]')
    }

    get quickjsVersion() {
        return $('[data-testid="setting-quickjs-version"]')
    }

    get videoCaptionerPath() {
        return $('[data-testid="setting-videocaptioner-path"]')
    }

    get useBundledFfmpegCheckbox() {
        return $('[data-testid="setting-use-bundled-ffmpeg-videocaptioner"]')
    }

    /**
     * Get yt-dlp browse button
     */
    get ytdlpBrowseButton() {
        return $('[data-testid="setting-ytdlp-browse"]')
    }

    /**
     * Get ffmpeg browse button
     */
    get ffmpegBrowseButton() {
        return $('[data-testid="setting-ffmpeg-browse"]')
    }

    // ==================== AI Settings ====================

    /**
     * Get all provider card elements
     */
    get providerCards() {
        return $$('[data-testid^="ai-provider-card-"]')
    }

    /**
     * Get a specific provider card by index
     */
    getProviderCard(index: number) {
        return $(`[data-testid="ai-provider-card-${index}"]`)
    }

    /**
     * Get provider name input by index
     */
    getProviderNameInput(index: number) {
        return $(`[data-testid="ai-provider-name-${index}"]`)
    }

    /**
     * Get provider base URL input by index
     */
    getProviderBaseUrlInput(index: number) {
        return $(`[data-testid="ai-provider-baseurl-${index}"]`)
    }

    /**
     * Get provider API key input by index
     */
    getProviderApiKeyInput(index: number) {
        return $(`[data-testid="ai-provider-apikey-${index}"]`)
    }

    /**
     * Get provider model input by index
     */
    getProviderModelInput(index: number) {
        return $(`[data-testid="ai-provider-model-${index}"]`)
    }

    /**
     * Get provider radio button by index
     */
    getProviderRadio(index: number) {
        return $(`[data-testid="ai-provider-radio-${index}"]`)
    }

    /**
     * Get provider delete button by index
     */
    getProviderDeleteButton(index: number) {
        return $(`[data-testid="ai-provider-delete-${index}"]`)
    }

    /**
     * Get the add provider button
     */
    get addProviderButton() {
        return $('[data-testid="ai-add-provider"]')
    }

    /**
     * Get the AI check button for a specific provider card
     */
    getProviderCheckButton(index: number) {
        return $(`[data-testid="ai-provider-check-${index}"]`)
    }

    /**
     * Get the AI check success message for a specific provider card
     */
    getProviderCheckSuccess(index: number) {
        return $(`[data-testid="ai-provider-check-success-${index}"]`)
    }

    /**
     * Get the AI check error message for a specific provider card
     */
    getProviderCheckError(index: number) {
        return $(`[data-testid="ai-provider-check-error-${index}"]`)
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
        const value = await element.getValue()
        return typeof value === 'string' ? value : String(value ?? '')
    }

    /**
     * Set the value of an input field.
     * Works with standard Input and {@link RadixDialogCompatibleCombobox}.
     * Does not press Escape — that closes the Radix config dialog when focus is on a plain input.
     */
    async setInputValue(element: ChainablePromiseElement, value: string): Promise<void> {
        await element.waitForExist({ timeout: 5000 })
        await element.scrollIntoView()
        await element.click()

        // Clear existing value (works cross-platform; Ctrl+A fails on macOS where Select All is Cmd+A)
        await element.clearValue()

        // Small delay to let React process the change
        await browser.pause(100)

        // regain focus on the input element
        await element.click()

        // Type the new value
        if (value.length > 0) {
            await browser.keys(value)
        }
    }

    /**
     * Whether a combobox listbox popover is open (Radix portals it outside ai-settings).
     */
    async isComboboxPopoverOpen(): Promise<boolean> {
        const listboxes = await $$('[role="listbox"]')
        for (const listbox of listboxes) {
            try {
                if (await listbox.isDisplayed()) {
                    return true
                }
            } catch {
                // stale element — continue
            }
        }
        return false
    }

    /**
     * Close a combobox popover via its toggle button (do not use Escape — it closes the config dialog).
     */
    async dismissComboboxPopover(comboboxInput: ChainablePromiseElement): Promise<void> {
        if (!(await this.isComboboxPopoverOpen())) {
            return
        }

        const toggle = await comboboxInput.parentElement().$('button[data-slot="combobox-toggle"]')
        await toggle.waitForExist({ timeout: 5000 })
        await toggle.waitForClickable({ timeout: 5000 })
        await toggle.click()

        await browser.waitUntil(async () => !(await this.isComboboxPopoverOpen()), {
            timeout: 3000,
            timeoutMsg: 'Combobox popover did not close after toggle click',
        })

        await browser.pause(100)
    }

    /**
     * Commit a creatable combobox value and close its popover.
     * Clicks the matching list option when present (Radix commit path); otherwise toggles closed.
     */
    async commitComboboxValue(comboboxInput: ChainablePromiseElement, value: string): Promise<void> {
        if (!(await this.isComboboxPopoverOpen())) {
            return
        }

        const trimmed = value.trim()
        const options = await $$('[role="listbox"] [role="option"]')
        for (const opt of options) {
            try {
                if (!(await opt.isDisplayed())) {
                    continue
                }
                const text = (await opt.getText()).trim()
                if (text === trimmed) {
                    await opt.click()
                    await browser.waitUntil(async () => !(await this.isComboboxPopoverOpen()), {
                        timeout: 3000,
                        timeoutMsg: `Combobox popover did not close after selecting option "${trimmed}"`,
                    })
                    await browser.pause(100)
                    return
                }
            } catch {
                // stale option — try next
            }
        }

        await this.dismissComboboxPopover(comboboxInput)
    }

    /**
     * Set a creatable combobox value, commit it, then focus the next field.
     */
    async setComboboxInputValue(
        element: ChainablePromiseElement,
        value: string,
        blurTarget: ChainablePromiseElement,
    ): Promise<void> {
        await element.waitForExist({ timeout: 5000 })
        await element.scrollIntoView()
        await element.click()
        await element.clearValue()
        await browser.pause(100)
        await element.setValue(value)
        await browser.pause(100)

        await this.commitComboboxValue(element, value)

        if (await this.isComboboxPopoverOpen()) {
            throw new Error('Combobox popover still open after commit')
        }

        await blurTarget.waitForExist({ timeout: 5000 })
        await blurTarget.scrollIntoView()
        await blurTarget.click()
        await browser.pause(150)
    }

    /**
     * Clear an input field
     */
    async clearInput(element: ChainablePromiseElement): Promise<void> {
        await element.waitForExist({ timeout: 5000 })
        await element.click()
        await element.clearValue()
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
     * Select a theme mode
     */
    async selectTheme(mode: ThemeMode): Promise<void> {
        const trigger = await this.themeSelectTrigger
        await trigger.waitForClickable({ timeout: 5000 })
        await trigger.click()

        await browser.pause(200)

        const option = await this.getThemeOption(mode)
        await option.waitForClickable({ timeout: 5000 })
        await option.click()
    }

    /**
     * Get the current theme selection
     */
    async getSelectedTheme(): Promise<string> {
        const trigger = await this.themeSelectTrigger
        return await trigger.getText()
    }

    /**
     * Select the primary metadata database (TMDB or TVDB)
     */
    async setPrimaryDatabase(db: "TMDB" | "TVDB"): Promise<void> {
        const trigger = await this.primaryDatabaseSelectTrigger
        await trigger.waitForExist({ timeout: 5000 })
        await trigger.scrollIntoView()
        await trigger.waitForDisplayed({ timeout: 5000 })
        await trigger.waitForClickable({ timeout: 5000 })
        await trigger.click()

        await browser.pause(200)

        const option = await this.getPrimaryDatabaseOption(db)
        await option.waitForExist({ timeout: 5000 })
        await option.scrollIntoView()
        await option.waitForDisplayed({ timeout: 5000 })
        await option.waitForClickable({ timeout: 5000 })
        await option.click()
    }

    /**
     * Get the current primary database selection (localized label text)
     */
    async getSelectedPrimaryDatabase(): Promise<string> {
        const trigger = await this.primaryDatabaseSelectTrigger
        return await trigger.getText()
    }

    /**
     * Set preferred media language
     */
    async setPreferMediaLanguage(code: PreferMediaLanguageCode): Promise<void> {
        const trigger = await this.preferMediaLanguageSelectTrigger
        await trigger.waitForDisplayed({ timeout: 5000 })
        await trigger.waitForClickable({ timeout: 5000 })
        await trigger.click()

        await browser.pause(200)

        const option = await this.getPreferMediaLanguageOption(code)
        await option.waitForDisplayed({ timeout: 5000 })
        await option.waitForClickable({ timeout: 5000 })
        await option.click()
    }

    /**
     * Get currently selected preferred media language (localized label text)
     */
    async getSelectedPreferMediaLanguage(): Promise<string> {
        const trigger = await this.preferMediaLanguageSelectTrigger
        return await trigger.getText()
    }

    /**
     * Set the TMDB host
     */
    async setTmdbHost(value: string): Promise<void> {
        if(value === '') {
            await this.tmdbHostInput.clearValue()
            await this.tmdbHostInput.click()
            await browser.keys('a')
            await browser.keys('Backspace')
            return
        }
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
     * Set the TVDB host
     */
    async setTvdbHost(value: string): Promise<void> {
        await this.setInputValue(this.tvdbHostInput, value)
    }

    /**
     * Get the TVDB host value
     */
    async getTvdbHost(): Promise<string> {
        return await this.getInputValue(this.tvdbHostInput)
    }

    /**
     * Set the TVDB API key
     */
    async setTvdbApiKey(value: string): Promise<void> {
        await this.setInputValue(this.tvdbApiKeyInput, value)
    }

    /**
     * Get the TVDB API key value
     */
    async getTvdbApiKey(): Promise<string> {
        return await this.getInputValue(this.tvdbApiKeyInput)
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

    /**
     * Get yt-dlp executable path value
     */
    async getYtdlpPath(): Promise<string> {
        return await this.getInputValue(this.ytdlpPathInput)
    }

    /**
     * Set yt-dlp executable path
     */
    async setYtdlpPath(value: string): Promise<void> {
        await this.setInputValue(this.ytdlpPathInput, value)
    }

    /**
     * Get ffmpeg executable path value
     */
    async getFfmpegPath(): Promise<string> {
        return await this.getInputValue(this.ffmpegPathInput)
    }

    /**
     * Set ffmpeg executable path
     */
    async setFfmpegPath(value: string): Promise<void> {
        await this.setInputValue(this.ffmpegPathInput, value)
    }

    // ==================== External Tools Actions ====================

    /**
     * Check if yt-dlp version is displayed (via specific testid).
     */
    async isYtdlpVersionDisplayed(): Promise<boolean> {
        try {
            const el = await this.ytdlpVersion
            return await el.isDisplayed()
        } catch {
            return false
        }
    }

    /**
     * Check if ffmpeg version is displayed (via specific testid).
     */
    async isFfmpegVersionDisplayed(): Promise<boolean> {
        try {
            const el = await this.ffmpegVersion
            return await el.isDisplayed()
        } catch {
            return false
        }
    }

    /**
     * Get yt-dlp version text (e.g. "Version: 2025.01.15").
     */
    async getYtdlpVersionText(): Promise<string> {
        try {
            const el = await this.ytdlpVersion
            return await el.getText()
        } catch {
            return ''
        }
    }

    /**
     * Get ffmpeg version text (e.g. "Version: 7.1").
     */
    async getFfmpegVersionText(): Promise<string> {
        try {
            const el = await this.ffmpegVersion
            return await el.getText()
        } catch {
            return ''
        }
    }

    /**
     * Get QuickJS version text (e.g. "Version: 2024-01-13").
     */
    async getQuickjsVersionText(): Promise<string> {
        try {
            const el = await this.quickjsVersion
            return await el.getText()
        } catch {
            return ''
        }
    }

    // ==================== AI Settings Actions ====================

    /**
     * Get the number of provider cards displayed
     */
    async getProviderCount(): Promise<number> {
        const cards = await this.providerCards
        return cards.length
    }

    /**
     * Click the radio button for a provider to set it as active
     */
    async selectActiveProvider(index: number): Promise<void> {
        const radio = await this.getProviderRadio(index)
        await radio.waitForClickable({ timeout: 5000 })
        await radio.click()
    }

    /**
     * Get the active provider index by checking radio button state
     */
    async getActiveProviderIndex(): Promise<number> {
        const count = await this.getProviderCount()
        for (let i = 0; i < count; i++) {
            const radio = await this.getProviderRadio(i)
            // The active provider has a CircleCheck icon (which may have aria-checked or classes)
            // We check if the radio is the active one by looking at the provider card's border class
            const card = await this.getProviderCard(i)
            const className = await card.getAttribute('class')
            if (className && className.includes('border-primary')) {
                return i
            }
        }
        return -1
    }

    /**
     * Get the name value of a provider by index
     */
    async getProviderName(index: number): Promise<string> {
        return await this.getInputValue(this.getProviderNameInput(index))
    }

    /**
     * Scroll a provider card into view inside the scrollable config panel.
     */
    async scrollProviderCardIntoView(index: number): Promise<void> {
        const card = await this.getProviderCard(index)
        await card.waitForExist({ timeout: 5000 })
        await card.scrollIntoView({ block: 'center' })
        await browser.pause(150)
    }

    /**
     * Set the provider name by index
     */
    async setProviderName(index: number, value: string): Promise<void> {
        await this.scrollProviderCardIntoView(index)
        await this.setComboboxInputValue(
            this.getProviderNameInput(index),
            value,
            this.getProviderBaseUrlInput(index),
        )
    }

    /**
     * Get the base URL value of a provider by index
     */
    async getProviderBaseUrl(index: number): Promise<string> {
        return await this.getInputValue(this.getProviderBaseUrlInput(index))
    }

    /**
     * Set the provider base URL by index
     */
    async setProviderBaseUrl(index: number, value: string): Promise<void> {
        await this.scrollProviderCardIntoView(index)
        await this.setInputValue(this.getProviderBaseUrlInput(index), value)
    }

    /**
     * Get the API key value of a provider by index
     */
    async getProviderApiKey(index: number): Promise<string> {
        return await this.getInputValue(this.getProviderApiKeyInput(index))
    }

    /**
     * Set the provider API key by index
     */
    async setProviderApiKey(index: number, value: string): Promise<void> {
        await this.scrollProviderCardIntoView(index)
        await this.setInputValue(this.getProviderApiKeyInput(index), value)
    }

    /**
     * Get the model value of a provider by index
     */
    async getProviderModel(index: number): Promise<string> {
        return await this.getInputValue(this.getProviderModelInput(index))
    }

    /**
     * Set the provider model by index
     */
    async setProviderModel(index: number, value: string): Promise<void> {
        await this.scrollProviderCardIntoView(index)
        await this.setComboboxInputValue(
            this.getProviderModelInput(index),
            value,
            this.getProviderCheckButton(index),
        )
    }

    /**
     * Fill all fields on a provider card (name/model use combobox commit helpers).
     */
    async fillProvider(
        index: number,
        provider: { name: string; baseURL: string; apiKey: string; model: string },
    ): Promise<void> {
        await this.scrollProviderCardIntoView(index)
        await this.setProviderName(index, provider.name)
        await this.setProviderBaseUrl(index, provider.baseURL)
        await this.setProviderApiKey(index, provider.apiKey)
        await this.setProviderModel(index, provider.model)
    }

    /**
     * Click the add provider button
     */
    async addProvider(): Promise<void> {
        const button = await this.addProviderButton
        await button.waitForClickable({ timeout: 5000 })
        await button.click()
    }

    /**
     * Click the delete button for a provider by index
     */
    async deleteProvider(index: number): Promise<void> {
        const button = await this.getProviderDeleteButton(index)
        await button.waitForClickable({ timeout: 5000 })
        await button.click()
    }

    /**
     * Check if the delete button for a provider exists (is rendered)
     */
    async isDeleteButtonPresent(index: number): Promise<boolean> {
        try {
            const button = await this.getProviderDeleteButton(index)
            return await button.isExisting()
        } catch {
            return false
        }
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
