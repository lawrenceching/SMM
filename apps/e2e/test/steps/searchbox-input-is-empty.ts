import { expect } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import { SearchboxCO } from '../componentobjects/Searchbox.co'

registerStep('searchbox input is empty', async () => {
    await SearchboxCO.input.waitForDisplayed()
    const value = await SearchboxCO.input.getValue()
    expect(value).toBe('')
})
