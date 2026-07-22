import { registerStep } from '../lib/gherkin'
import page from 'test/pageobjects/page'

registerStep('I refresh the browser page', async () => {
    await page.refresh()
})
