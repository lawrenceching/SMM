import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('AI recognize prompt is displayed', async () => {
    await Prompts.aiBasedRecognizePrompt.waitForDisplayed({ timeout: 10000 })
})

registerStep('I confirm floating prompt', async () => {
    await Prompts.confirmButton.waitForClickable({ timeout: 10000 })
    await Prompts.confirmButton.click()
})
