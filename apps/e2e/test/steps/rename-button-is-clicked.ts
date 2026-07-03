import { registerStep } from '../lib/gherkin'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'

registerStep('I click "Rename" button', async (_ctx, _args) => {
    await TvShowPanelCO.renameButton.waitForClickable({ timeout: 10000 })
    await TvShowPanelCO.renameButton.click()
})
