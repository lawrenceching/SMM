import { registerStep } from '../lib/gherkin'
import { startEmbeddedHttpProxy } from '../lib/httpProxyServer'

registerStep('Start HTTP proxy in "xxx"', async (_ctx, args) => {
    const [address] = args
    await startEmbeddedHttpProxy(address)
})
