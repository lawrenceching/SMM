import { browser } from '@wdio/globals'

describe('Hello - Electron app smoke', () => {
    it('should launch SMM and expose a non-empty window title', async () => {
        const title = await browser.getTitle()
        console.log(`SMM Electron window title: "${title}"`)
        expect(title.trim().length).toBeGreaterThan(0)
    })
})
