import { expect } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('"Rename" confirm button is disabled', async (_ctx, _args) => {
    await Prompts.confirmButton.waitForExist({ timeout: 10000 })
    expect(await Prompts.confirmButton.isEnabled()).toBe(false)
})
