import { registerStep } from '../lib/gherkin'
import Sidebar from 'test/componentobjects/Sidebar'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'

registerStep('folder "xxx" was selected', async (_ctx, args) => {
    const [folderName] = args
    await Sidebar.clickFolder(folderName)
    await TvShowPanelCO.waitForTable(30000)
})
