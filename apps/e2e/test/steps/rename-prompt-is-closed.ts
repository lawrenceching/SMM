import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('"Rename" prompt is closed', async (_ctx, _args) => {
    await Prompts.cancelButton.waitForDisplayed({ timeout: 5000, reverse: true })
})
