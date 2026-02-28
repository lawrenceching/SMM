import { browser } from '@wdio/globals'

describe('Hello - WDIO Test Environment Verification', () => {
    it('should navigate to example.com and verify the title', async () => {
        await browser.url('https://www.example.com')
        const title = await browser.getTitle()
        expect(title).toBe('Example Domain')
    })
})
