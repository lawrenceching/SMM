import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'

registerStep('I refresh the browser page', async () => {
    await browser.refresh()
})
