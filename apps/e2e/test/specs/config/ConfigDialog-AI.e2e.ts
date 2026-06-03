import { expect, browser } from '@wdio/globals'
import Menu from '../../componentobjects/Menu'
import ConfigDialog from '../../componentobjects/ConfigDialog'
import StatusBar from '../../componentobjects/StatusBar'
import Page from '../../pageobjects/page'
import { cleanup, setup } from '../../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

/** Must not match resetUserConfig default (DeepSeek) or COMMON_AI_PROVIDER_NAMES presets. */
const testProvider = {
    name: 'SMM E2E Unique Provider',
    baseURL: 'https://api.example.com/v1',
    apiKey: 'e2e-test-key',
    model: 'e2e-test-model',
}

async function findProviderIndexByName(name: string): Promise<number> {
    const count = await ConfigDialog.getProviderCount()
    for (let i = 0; i < count; i++) {
        if ((await ConfigDialog.getProviderName(i)) === name) {
            return i
        }
    }
    return -1
}

describe('Config Dialog AI Settings', () => {

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

    async function reloadAndWaitForReady(): Promise<void> {
        await Page.refresh()
        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after page reload',
        })
        await browser.pause(500)
    }

    async function saveAndCloseDialog(): Promise<void> {
        await ConfigDialog.clickSave()
        await ConfigDialog.pressEscape()
        await browser.pause(200)
        await ConfigDialog.pressEscape()
        await ConfigDialog.waitForClosed()
    }

    async function openAiSettings(): Promise<void> {
        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()
        expect(await ConfigDialog.isDisplayed()).toBe(true)

        if (slowdown) await delay(1000)

        await ConfigDialog.clickTab('ai')

        if (slowdown) await delay(1000)

        const aiSettings = $('[data-testid="ai-settings"]')
        await aiSettings.waitForDisplayed({ timeout: 5000 })
    }

    it(`Create a new AI provider`, async function() {
        if (slowdown) {
            this.timeout(120 * 1000)
        }

        await openAiSettings()

        const initialCount = await ConfigDialog.getProviderCount()

        await ConfigDialog.addProvider()

        await browser.waitUntil(async () => {
            return (await ConfigDialog.getProviderCount()) === initialCount + 1
        }, {
            timeout: 5000,
            timeoutMsg: `New AI provider card did not appear (expected ${initialCount + 1} cards)`,
        })

        const newIndex = initialCount

        await ConfigDialog.fillProvider(newIndex, testProvider)

        if (slowdown) await delay(600)

        await ConfigDialog.waitForSaveButton()

        await saveAndCloseDialog()

        await reloadAndWaitForReady()

        await openAiSettings()

        expect(await ConfigDialog.getProviderCount()).toBe(initialCount + 1)

        const foundIndex = await findProviderIndexByName(testProvider.name)
        expect(foundIndex).toBeGreaterThanOrEqual(0)

        expect(await ConfigDialog.getProviderName(foundIndex)).toBe(testProvider.name)
        expect(await ConfigDialog.getProviderBaseUrl(foundIndex)).toBe(testProvider.baseURL)
        expect(await ConfigDialog.getProviderApiKey(foundIndex)).toBe(testProvider.apiKey)
        expect(await ConfigDialog.getProviderModel(foundIndex)).toBe(testProvider.model)

        const card = await ConfigDialog.getProviderCard(foundIndex)
        await card.waitForDisplayed({ timeout: 5000 })
    })
})
