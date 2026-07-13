import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import { SearchboxCO } from '../componentobjects/Searchbox.co'

registerStep('I select search result with title "xxx" and date "xxx"', async (_ctx, args) => {
    const [title, date] = args
    await SearchboxCO.selectSearchResult({ title, date })
})

registerStep('I select search result with title "xxx"', async (_ctx, args) => {
    const [title] = args
    await browser.pause(1000)
    await SearchboxCO.selectSearchResultByText(title!)
})
