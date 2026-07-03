import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('I click "Confirm" on rename prompt', async (_ctx, _args) => {
    await Prompts.confirmButton.waitForClickable({ timeout: 5000 })
    await Prompts.confirmButton.click()
})
