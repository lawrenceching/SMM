import type { PreferMediaLanguage } from '@smm/types'
import { registerStep, requiredStepArg } from '../lib/gherkin'
import { updateUserConfig } from '../lib/testbed'

registerStep('prefer media language is "xxx"', async (_ctx, args) => {
    const language = requiredStepArg(args, 0) as PreferMediaLanguage
    await updateUserConfig((userConfig) => ({
        ...userConfig,
        preferMediaLanguage: language,
    }))
})
