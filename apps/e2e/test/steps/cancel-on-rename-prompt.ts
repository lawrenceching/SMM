import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('I click "Cancel" on rename prompt', async (_ctx, _args) => {
    await Prompts.cancelButton.waitForClickable({ timeout: 5000 })
    await Prompts.cancelButton.click()
})
