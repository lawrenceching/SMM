import { expect, browser } from '@wdio/globals'
import Menu from '../../componentobjects/Menu'
import ConfigDialog from '../../componentobjects/ConfigDialog'
import StatusBar from '../../componentobjects/StatusBar'
import Page from '../../pageobjects/page'
import { createBeforeHook } from '../../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

describe('Config Dialog AI Settings', () => {
    before(async () => {
        await createBeforeHook({ setupMediaFolders: false })()
    })

    beforeEach(async () => {
        await reloadAndWaitForReady()
    })

    async function reloadAndWaitForReady(): Promise<void> {
        await Page.refresh()
        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after page reload'
        })
        await browser.pause(500)
        console.log('Page reloaded and ready')
    }

    async function saveAndCloseDialog(): Promise<void> {
        await ConfigDialog.clickSave()
        await ConfigDialog.pressEscape()
        await browser.pause(200)
        await ConfigDialog.pressEscape()
        await ConfigDialog.waitForClosed()
    }

    async function openAiSettings(): Promise<void> {
        console.log('Opening config dialog...')
        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()
        expect(await ConfigDialog.isDisplayed()).toBe(true)

        if (slowdown) await delay(1000)

        console.log('Switching to AI settings tab...')
        await ConfigDialog.clickTab('ai')

        if (slowdown) await delay(1000)

        const aiSettings = $('[data-testid="ai-settings"]')
        await aiSettings.waitForDisplayed({ timeout: 5000 })
    }

    describe('AI Settings - Provider Cards', () => {
        it('should start with no providers and allow adding one', async function() {
            await openAiSettings()

            let count = await ConfigDialog.getProviderCount()
            console.log(`Initial provider count: ${count}`)
            expect(count).toBe(0)

            // Add a provider
            console.log('Adding a new provider...')
            await ConfigDialog.addProvider()
            await browser.pause(200)

            count = await ConfigDialog.getProviderCount()
            expect(count).toBe(1)

            // Fill in provider details
            const providerName = 'MyAI'
            const baseUrl = 'https://api.myai.com/v1'
            const apiKey = 'sk-test-key'
            const model = 'my-model'

            await ConfigDialog.setProviderName(0, providerName)
            await ConfigDialog.setProviderBaseUrl(0, baseUrl)
            await ConfigDialog.setProviderApiKey(0, apiKey)
            await ConfigDialog.setProviderModel(0, model)

            // Save and verify persistence
            console.log('Saving and reloading...')
            await saveAndCloseDialog()
            await reloadAndWaitForReady()
            await openAiSettings()

            count = await ConfigDialog.getProviderCount()
            expect(count).toBe(1)

            const persistedName = await ConfigDialog.getProviderName(0)
            expect(persistedName).toBe(providerName)

            const persistedBaseUrl = await ConfigDialog.getProviderBaseUrl(0)
            expect(persistedBaseUrl).toBe(baseUrl)

            const persistedApiKey = await ConfigDialog.getProviderApiKey(0)
            expect(persistedApiKey).toBe(apiKey)

            const persistedModel = await ConfigDialog.getProviderModel(0)
            expect(persistedModel).toBe(model)

            console.log('Provider added and persisted correctly')
        })

        it('should switch active provider via radio button', async function() {
            await openAiSettings()

            // Add two providers
            console.log('Adding provider 1...')
            await ConfigDialog.addProvider()
            await browser.pause(100)
            await ConfigDialog.setProviderName(0, 'ProviderA')
            await ConfigDialog.setProviderBaseUrl(0, 'https://api.a.com')
            await ConfigDialog.setProviderApiKey(0, 'key-a')
            await ConfigDialog.setProviderModel(0, 'model-a')

            console.log('Adding provider 2...')
            await ConfigDialog.addProvider()
            await browser.pause(100)
            await ConfigDialog.setProviderName(1, 'ProviderB')
            await ConfigDialog.setProviderBaseUrl(1, 'https://api.b.com')
            await ConfigDialog.setProviderApiKey(1, 'key-b')
            await ConfigDialog.setProviderModel(1, 'model-b')

            // First added is active by default
            let activeIndex = await ConfigDialog.getActiveProviderIndex()
            expect(activeIndex).toBe(0)

            // Switch to ProviderB (index 1)
            console.log('Switching active provider to ProviderB...')
            await ConfigDialog.selectActiveProvider(1)
            activeIndex = await ConfigDialog.getActiveProviderIndex()
            expect(activeIndex).toBe(1)

            // Save and verify persistence
            console.log('Saving and reloading...')
            await saveAndCloseDialog()
            await reloadAndWaitForReady()
            await openAiSettings()

            activeIndex = await ConfigDialog.getActiveProviderIndex()
            expect(activeIndex).toBe(1)
            console.log('Active provider persisted correctly')
        })

        it('should add a new provider and persist', async function() {
            await openAiSettings()

            const initialCount = await ConfigDialog.getProviderCount()
            console.log(`Initial provider count: ${initialCount}`)

            console.log('Adding a new provider...')
            await ConfigDialog.addProvider()
            await browser.pause(200)

            const afterAddCount = await ConfigDialog.getProviderCount()
            expect(afterAddCount).toBe(initialCount + 1)

            const newIndex = afterAddCount - 1
            const newName = 'CustomAI'
            const newBaseUrl = 'https://custom-ai.com/v1'
            const newApiKey = 'sk-custom-key'
            const newModel = 'custom-model-v1'

            await ConfigDialog.setProviderName(newIndex, newName)
            await ConfigDialog.setProviderBaseUrl(newIndex, newBaseUrl)
            await ConfigDialog.setProviderApiKey(newIndex, newApiKey)
            await ConfigDialog.setProviderModel(newIndex, newModel)

            if (slowdown) await delay(300)

            console.log('Saving and reloading...')
            await saveAndCloseDialog()
            await reloadAndWaitForReady()
            await openAiSettings()

            const persistedCount = await ConfigDialog.getProviderCount()
            expect(persistedCount).toBe(initialCount + 1)

            expect(await ConfigDialog.getProviderName(newIndex)).toBe(newName)
            expect(await ConfigDialog.getProviderBaseUrl(newIndex)).toBe(newBaseUrl)
            expect(await ConfigDialog.getProviderApiKey(newIndex)).toBe(newApiKey)
            expect(await ConfigDialog.getProviderModel(newIndex)).toBe(newModel)
            console.log('New provider persisted correctly')
        })

        it('should delete a provider and auto-select another when active provider is deleted', async function() {
            await openAiSettings()

            // Add two providers so we have something to work with
            await ConfigDialog.addProvider()
            await browser.pause(100)
            await ConfigDialog.setProviderName(0, 'First')
            await ConfigDialog.setProviderBaseUrl(0, 'https://first.com')
            await ConfigDialog.setProviderApiKey(0, 'key1')
            await ConfigDialog.setProviderModel(0, 'model1')

            await ConfigDialog.addProvider()
            await browser.pause(100)
            await ConfigDialog.setProviderName(1, 'Second')
            await ConfigDialog.setProviderBaseUrl(1, 'https://second.com')
            await ConfigDialog.setProviderApiKey(1, 'key2')
            await ConfigDialog.setProviderModel(1, 'model2')

            const initialCount = await ConfigDialog.getProviderCount()
            expect(initialCount).toBe(2)

            // Set the second provider as active
            await ConfigDialog.selectActiveProvider(1)
            let activeIndex = await ConfigDialog.getActiveProviderIndex()
            expect(activeIndex).toBe(1)

            // Delete the active provider
            console.log('Deleting active provider (index 1)...')
            await ConfigDialog.deleteProvider(1)
            await browser.pause(200)

            const afterDeleteCount = await ConfigDialog.getProviderCount()
            expect(afterDeleteCount).toBe(1)

            // Should auto-select first remaining
            activeIndex = await ConfigDialog.getActiveProviderIndex()
            expect(activeIndex).toBe(0)
            console.log(`Active provider fell back to index ${activeIndex}`)
        })

        it('should hide delete button when only 1 provider remains', async function() {
            await openAiSettings()

            // Add a provider
            await ConfigDialog.addProvider()
            await browser.pause(100)

            let count = await ConfigDialog.getProviderCount()
            expect(count).toBe(1)

            // Delete button should NOT be present for the only provider
            const hasDelete = await ConfigDialog.isDeleteButtonPresent(0)
            expect(hasDelete).toBe(false)
            console.log('Delete button hidden when only 1 provider remains')
        })

        it('should show check button per provider card', async function() {
            await openAiSettings()

            // Add a provider with required fields
            await ConfigDialog.addProvider()
            await browser.pause(100)
            await ConfigDialog.setProviderName(0, 'TestAI')
            await ConfigDialog.setProviderBaseUrl(0, 'https://test-ai.com/v1')
            await ConfigDialog.setProviderApiKey(0, 'sk-test')
            await ConfigDialog.setProviderModel(0, 'test-model')

            // Verify the check button exists for the card
            const checkButton = await ConfigDialog.getProviderCheckButton(0)
            await checkButton.waitForExist({ timeout: 5000 })
            expect(await checkButton.isExisting()).toBe(true)

            // Add another provider and verify its check button exists too
            await ConfigDialog.addProvider()
            await browser.pause(100)
            const checkButton2 = await ConfigDialog.getProviderCheckButton(1)
            await checkButton2.waitForExist({ timeout: 5000 })
            expect(await checkButton2.isExisting()).toBe(true)

            console.log('Each provider card has its own check button')
        })
    })
})
