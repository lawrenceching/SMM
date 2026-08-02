import { registerStep, requiredStepArg } from '../lib/gherkin'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'

registerStep('I click "xxx" from episode "xxx" context menu', async (_ctx, args) => {
    await TvShowPanelCO.openAndClickContextMenuForEpisode(
        requiredStepArg(args, 1),
        requiredStepArg(args, 0),
    )
})
