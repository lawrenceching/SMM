import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'

registerStep('mock file pick is set to "xxx"', async (_ctx, args) => {
    const [filePath] = args
    await browser.execute((mockFilePath) => {
        (window as unknown as { localStorage: Storage }).localStorage.setItem('test.mockFilePick', mockFilePath)
    }, filePath)
})
