import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import page from 'test/pageobjects/page'

/**
 * Initial navigation only. Prefer setup({ openBrowserPage: true });
 * fixture steps reload via page.refresh() after setup has opened the UI.
 */
registerStep('page is opened', async () => {
    await page.open()
    await browser.pause(1000)
})
