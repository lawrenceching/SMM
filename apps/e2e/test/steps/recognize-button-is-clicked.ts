import { registerStep } from '../lib/gherkin'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'

registerStep('I click "Recognize" button', async (_ctx, _args) => {
    await TvShowPanelCO.recognizeButton.waitForClickable({ timeout: 10000 })
    await TvShowPanelCO.recognizeButton.click()
})
