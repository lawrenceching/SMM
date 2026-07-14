import { registerStep } from '../lib/gherkin'
import TVShowPanel from '../componentobjects/TVShowPanel.co'

registerStep('searchbox input is focused', async () => {
    await TVShowPanel.searchbox.input.waitForDisplayed()
    await TVShowPanel.searchbox.input.click()
})
