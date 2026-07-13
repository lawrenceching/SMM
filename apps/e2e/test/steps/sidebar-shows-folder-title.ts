import { registerStep } from '../lib/gherkin'

registerStep('Sidebar shows folder with title "xxx"', async (ctx, args) => {
    const [expectedTitle] = args
    const { default: Sidebar } = await import('../componentobjects/Sidebar')
    await Sidebar.waitForFolderTitle(expectedTitle, 60000)
    ctx._folderTitle = expectedTitle
})
