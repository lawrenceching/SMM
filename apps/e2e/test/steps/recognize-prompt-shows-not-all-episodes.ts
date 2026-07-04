import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('"Recognize" prompt shows not all episodes message', async (_ctx, _args) => {
    await Prompts.ruleBasedRecognizeNotAllMessage.waitForDisplayed({ timeout: 30000 })
})

registerStep('"Recognize" hint icon is visible', async (_ctx, _args) => {
    await Prompts.ruleBasedRecognizeHintIcon.waitForDisplayed({ timeout: 10000 })
})
