import { expect } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'

registerStep('"Recognize" hint tooltip is displayed with content', async (_ctx, _args) => {
    await Prompts.ruleBasedRecognizeHintTooltip.waitForDisplayed({ timeout: 10000 })
    const tooltipText = (await Prompts.ruleBasedRecognizeHintTooltip.getText()).trim()
    expect(tooltipText.length).toBeGreaterThan(10)
    expect(tooltipText).not.toMatch(/^toolbar\./)
})
