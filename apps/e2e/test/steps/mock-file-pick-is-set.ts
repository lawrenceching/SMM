import { browser } from '@wdio/globals'
import { registerStep, requiredStepArg } from '../lib/gherkin'

registerStep('mock file pick is set to "xxx"', async (_ctx, args) => {
    const filePath = requiredStepArg(args, 0)
    await browser.execute((mockFilePath) => {
        (window as unknown as { localStorage: Storage }).localStorage.setItem('test.mockFilePick', mockFilePath)
    }, filePath)
})
