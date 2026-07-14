import { registerStep } from '../lib/gherkin'
import { SearchboxCO } from '../componentobjects/Searchbox.co'

registerStep('I select "xxx" as the search database', async (_ctx, args) => {
    const [database] = args
    await SearchboxCO.setDatabase(database!)
})
