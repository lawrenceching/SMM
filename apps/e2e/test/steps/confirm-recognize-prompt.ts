import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('I click "Confirm" on recognize prompt', async (_ctx, _args) => {
    await Prompts.confirmButton.waitForClickable({ timeout: 10000 })
    await Prompts.confirmButton.click()
})