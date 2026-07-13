import { registerStep } from '../lib/gherkin'
import { updateUserConfig } from '../lib/testbed'

registerStep('prefer media language is "xxx"', async (_ctx, args) => {
    const [language] = args
    await updateUserConfig((userConfig) => ({
        ...userConfig,
        preferMediaLanguage: language,
    }))
})
