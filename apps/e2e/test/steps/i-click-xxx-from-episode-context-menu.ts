import { registerStep } from '../lib/gherkin'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'

registerStep('I click "xxx" from episode "xxx" context menu', async (_ctx, args) => {
    const [menuItem, episodeId] = args
    await TvShowPanelCO.openAndClickContextMenuForEpisode(episodeId, menuItem)
})
