import { registerStep } from '../lib/gherkin'
import { SearchboxCO } from '../componentobjects/Searchbox.co'

registerStep('I search for "xxx"', async (_ctx, args) => {
    const [keyword] = args
    await SearchboxCO.input.setValue(keyword!)
    await SearchboxCO.searchButton.click()
})
