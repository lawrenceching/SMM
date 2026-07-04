import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('I hover over "Recognize" hint icon', async (_ctx, _args) => {
    await Prompts.ruleBasedRecognizeHintIcon.waitForDisplayed({ timeout: 10000 })
    await Prompts.ruleBasedRecognizeHintIcon.moveTo()
})
