import { registerStep } from '../lib/gherkin'
import { startConfigServer } from '../lib/configServer'

registerStep('Start config server at "xxx"', async (_ctx, args) => {
    const [address] = args
    await startConfigServer(address)
})
