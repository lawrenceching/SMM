import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import page from 'test/pageobjects/page'

registerStep('page is opened', async () => {
    await page.open()
    await browser.pause(1000)
})
