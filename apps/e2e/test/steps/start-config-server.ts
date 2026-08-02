import { registerStep, requiredStepArg } from '../lib/gherkin'
import { startConfigServer } from '../lib/configServer'

registerStep('Start config server at "xxx"', async (_ctx, args) => {
    await startConfigServer(requiredStepArg(args, 0))
})
