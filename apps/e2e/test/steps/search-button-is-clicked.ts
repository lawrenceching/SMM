import { registerStep } from '../lib/gherkin'
import { SearchboxCO } from '../componentobjects/Searchbox.co'

registerStep('I click the search button in the searchbox', async () => {
    const button = await SearchboxCO.searchButton
    await button.waitForClickable({ timeout: 5000 })
    await button.click()
})
