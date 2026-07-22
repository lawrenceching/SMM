import { expect } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import { SearchboxCO } from '../componentobjects/Searchbox.co'

registerStep('searchbox input is empty', async () => {
    await SearchboxCO.waitForImmersiveInputDisplayed(15000)
    const value = await SearchboxCO.input.getValue()
    expect(value).toBe('')
})
