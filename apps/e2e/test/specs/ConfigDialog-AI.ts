import { expect, browser } from '@wdio/globals'
import Menu from '../componentobjects/Menu'
import ConfigDialog from '../componentobjects/ConfigDialog'
import StatusBar from '../componentobjects/StatusBar'
import Page from '../pageobjects/page'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

// AI providers to test
const aiProviders = ['OpenAI', 'DeepSeek', 'OpenRouter', 'GLM', 'Other']

// Test data for each provider
const testData: Record<string, { baseUrl: string; apiKey: string; model: string }> = {
    'OpenAI': {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-openai-key-12345',
        model: 'gpt-4o'
    },
    'DeepSeek': {
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'test-deepseek-key-67890',
        model: 'deepseek-chat'
    },
    'OpenRouter': {
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'test-openrouter-key-abcde',
        model: 'anthropic/claude-3-opus'
    },
    'GLM': {
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: 'test-glm-key-fghij',
        model: 'glm-4'
    },
    'Other': {
        baseUrl: 'https://custom-ai.example.com/v1',
        apiKey: 'test-other-key-klmno',
        model: 'custom-model'
    }
}

describe('Config Dialog AI Settings', () => {
    before(async () => {
        await createBeforeHook({ setupMediaFolders: false })()
    })

    beforeEach(async () => {
        // Refresh page before each test to reset page state
        await reloadAndWaitForReady()
    })

    /**
     * Helper function to reload page and wait for it to be ready
     */
    async function reloadAndWaitForReady(): Promise<void> {
        await Page.refresh()
        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after page reload'
        })
        // Add a small delay to let the UI stabilize after reload
        await browser.pause(500)
        console.log('Page reloaded and ready')
    }

    /**
     * Helper function to save settings and close dialog + menu
     */
    async function saveAndCloseDialog(): Promise<void> {
        await ConfigDialog.clickSave()
        // Press Escape twice: once to close dialog, once to close menu dropdown
        await ConfigDialog.pressEscape()
        await browser.pause(200)
        await ConfigDialog.pressEscape()
        await ConfigDialog.waitForClosed()
    }

    /**
     * Helper function to open AI settings in config dialog
     */
    async function openAiSettings(): Promise<void> {
        console.log('Opening config dialog...')
        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()
        expect(await ConfigDialog.isDisplayed()).toBe(true)

        if (slowdown) {
            await delay(1000)
        }

        // Switch to AI tab
        console.log('Switching to AI settings tab...')
        await ConfigDialog.clickTab('ai')

        if (slowdown) {
            await delay(1000)
        }

        // Wait for AI settings to be displayed
        const aiSettings = $('[data-testid="ai-settings"]')
        await aiSettings.waitForDisplayed({ timeout: 5000 })
    }

    /**
     * Helper function to set AI provider configuration
     */
    async function setAiProviderConfig(
        provider: string,
        baseUrl: string,
        apiKey: string,
        model: string
    ): Promise<void> {
        console.log(`Setting AI provider: ${provider}`)
        await ConfigDialog.selectAiProvider(provider)

        if (slowdown) {
            await delay(500)
        }

        console.log(`Setting base URL: ${baseUrl}`)
        await ConfigDialog.setAiBaseUrl(baseUrl)

        if (slowdown) {
            await delay(500)
        }

        console.log(`Setting API key: ${apiKey}`)
        await ConfigDialog.setAiApiKey(apiKey)

        if (slowdown) {
            await delay(500)
        }

        console.log(`Setting model: ${model}`)
        await ConfigDialog.setAiModel(model)

        if (slowdown) {
            await delay(500)
        }
    }

    /**
     * Helper function to verify AI provider configuration
     */
    async function verifyAiProviderConfig(
        provider: string,
        expectedBaseUrl: string,
        expectedApiKey: string,
        expectedModel: string
    ): Promise<void> {
        // Verify selected provider
        const selectedProvider = await ConfigDialog.getSelectedAiProvider()
        console.log(`Current selected provider: ${selectedProvider}`)
        expect(selectedProvider).toBe(provider)

        // Verify base URL
        const baseUrl = await ConfigDialog.getAiBaseUrl()
        console.log(`Current base URL: ${baseUrl}`)
        expect(baseUrl).toBe(expectedBaseUrl)

        // Verify API key
        const apiKey = await ConfigDialog.getAiApiKey()
        console.log(`Current API key: ${apiKey}`)
        expect(apiKey).toBe(expectedApiKey)

        // Verify model
        const model = await ConfigDialog.getAiModel()
        console.log(`Current model: ${model}`)
        expect(model).toBe(expectedModel)
    }

    describe('AI Settings - Provider Configuration', () => {
        it('should change and persist AI provider settings for all providers', async function() {
            if (slowdown) {
                this.timeout(300 * 1000)
            }

            // Store original settings to revert at the end
            let originalProvider: string = ''

            // Step 1: Open AI settings and get initial provider
            console.log('Step 1: Opening AI settings to get initial provider...')
            await openAiSettings()

            originalProvider = await ConfigDialog.getSelectedAiProvider()
            console.log(`Original AI provider: ${originalProvider}`)

            // Test each AI provider
            for (const provider of aiProviders) {
                console.log(`\n========== Testing provider: ${provider} ==========`)

                const data = testData[provider]

                // Step 2: Set the provider configuration
                console.log(`Step 2: Setting ${provider} configuration...`)
                await setAiProviderConfig(provider, data.baseUrl, data.apiKey, data.model)

                // Step 3: Save and close dialog
                console.log('Step 3: Saving settings and closing dialog...')
                await saveAndCloseDialog()

                // Step 4: Reload the page
                console.log('Step 4: Reloading page...')
                await reloadAndWaitForReady()

                // Step 5: Open AI settings and verify persistence
                console.log('Step 5: Opening AI settings to verify persistence...')
                await openAiSettings()

                // Verify the settings are persisted
                await verifyAiProviderConfig(provider, data.baseUrl, data.apiKey, data.model)

                console.log(`✓ ${provider} settings persisted correctly!`)

                if (slowdown) {
                    await delay(1000)
                }
            }

            // Step 6: Revert to original provider
            console.log('\n========== Reverting to original settings ==========')
            console.log(`Reverting to original provider: ${originalProvider}`)

            if (originalProvider && aiProviders.includes(originalProvider)) {
                const originalData = testData[originalProvider]
                await setAiProviderConfig(
                    originalProvider,
                    originalData.baseUrl,
                    originalData.apiKey,
                    originalData.model
                )
                await saveAndCloseDialog()
            } else {
                // If original was not in our test list, just close without saving
                await ConfigDialog.pressEscape()
                await browser.pause(200)
                await ConfigDialog.pressEscape()
                await ConfigDialog.waitForClosed()
            }

            console.log('\nAI Settings test completed successfully!')
        })

        it('should switch between providers and preserve each provider configuration', async function() {
            if (slowdown) {
                this.timeout(180 * 1000)
            }

            // Step 1: Open AI settings
            console.log('Step 1: Opening AI settings...')
            await openAiSettings()

            // Step 2: Configure multiple providers without saving
            console.log('Step 2: Configuring multiple providers (DeepSeek first)...')
            await setAiProviderConfig('DeepSeek', testData['DeepSeek'].baseUrl, testData['DeepSeek'].apiKey, testData['DeepSeek'].model)

            // Switch to OpenAI
            console.log('Switching to OpenAI...')
            await ConfigDialog.selectAiProvider('OpenAI')
            await delay(300)

            // Configure OpenAI
            await ConfigDialog.setAiBaseUrl(testData['OpenAI'].baseUrl)
            await ConfigDialog.setAiApiKey(testData['OpenAI'].apiKey)
            await ConfigDialog.setAiModel(testData['OpenAI'].model)

            if (slowdown) {
                await delay(500)
            }

            // Step 3: Save settings
            console.log('Step 3: Saving settings...')
            await saveAndCloseDialog()

            // Step 4: Reload and verify
            console.log('Step 4: Reloading and verifying...')
            await reloadAndWaitForReady()
            await openAiSettings()

            // Should be on OpenAI (last selected)
            let selectedProvider = await ConfigDialog.getSelectedAiProvider()
            expect(selectedProvider).toBe('OpenAI')

            let baseUrl = await ConfigDialog.getAiBaseUrl()
            expect(baseUrl).toBe(testData['OpenAI'].baseUrl)

            console.log('OpenAI configuration verified!')

            // Step 5: Switch to DeepSeek and verify its config is preserved
            console.log('Step 5: Switching to DeepSeek and verifying preserved config...')
            await ConfigDialog.selectAiProvider('DeepSeek')
            await delay(300)

            selectedProvider = await ConfigDialog.getSelectedAiProvider()
            expect(selectedProvider).toBe('DeepSeek')

            baseUrl = await ConfigDialog.getAiBaseUrl()
            expect(baseUrl).toBe(testData['DeepSeek'].baseUrl)

            const apiKey = await ConfigDialog.getAiApiKey()
            expect(apiKey).toBe(testData['DeepSeek'].apiKey)

            const model = await ConfigDialog.getAiModel()
            expect(model).toBe(testData['DeepSeek'].model)

            console.log('DeepSeek configuration verified!')

            // Step 6: Revert to DeepSeek with empty values
            console.log('Step 6: Reverting to initial state...')
            await ConfigDialog.setAiBaseUrl('')
            await ConfigDialog.setAiApiKey('')
            await ConfigDialog.setAiModel('')
            await saveAndCloseDialog()

            console.log('Provider switching test completed successfully!')
        })
    })
})
