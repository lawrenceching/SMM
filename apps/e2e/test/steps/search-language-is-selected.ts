import { registerStep } from '../lib/gherkin'
import { SearchboxCO } from '../componentobjects/Searchbox.co'

registerStep('I select "xxx" as the search language', async (_ctx, args) => {
    const [language] = args
    await SearchboxCO.setLanguage(language!)
})
