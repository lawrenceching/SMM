import { expect } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'

registerStep('"Rename" button is disabled', async (_ctx, _args) => {
    await TvShowPanelCO.renameButton.waitForExist({ timeout: 10000 })
    expect(await TvShowPanelCO.renameButton.isEnabled()).toBe(false)
})
