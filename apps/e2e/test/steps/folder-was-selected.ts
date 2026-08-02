import { registerStep, requiredStepArg } from '../lib/gherkin'
import Sidebar from 'test/componentobjects/Sidebar'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'

registerStep('folder "xxx" was selected', async (_ctx, args) => {
    const folderName = requiredStepArg(args, 0)
    await Sidebar.clickFolder(folderName)
    await TvShowPanelCO.waitForTable(30000)
})
