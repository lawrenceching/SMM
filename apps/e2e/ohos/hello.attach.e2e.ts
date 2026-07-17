import { browser } from '@wdio/globals'

describe('Hello - HarmonyOS Electron attach smoke', () => {
    it('should attach to running SMM and read a non-empty title', async () => {
        // Attach mode: app is already open; no browser.url() needed.
        await browser.waitUntil(
            async () => (await browser.getTitle()).trim().length > 0,
            { timeout: 30000, timeoutMsg: 'Window title still empty' },
        )
        const title = await browser.getTitle()
        console.log(`HarmonyOS Electron window title: "${title}"`)
        expect(title.trim().length).toBeGreaterThan(0)
    })
})
