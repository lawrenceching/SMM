import { registerStep, requiredStepArg } from '../lib/gherkin'
import { startEmbeddedHttpProxy } from '../lib/httpProxyServer'

registerStep('Start HTTP proxy in "xxx"', async (_ctx, args) => {
    await startEmbeddedHttpProxy(requiredStepArg(args, 0))
})
