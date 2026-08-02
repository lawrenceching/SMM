import { browser } from '@wdio/globals'
import { registerStep, requiredStepArg } from '../lib/gherkin'

registerStep('debug override default tmdb asset server host is "xxx"', async (_ctx, args) => {
  const host = requiredStepArg(args, 0)
  await browser.execute((h: string) => {
    localStorage.setItem('debug.overrideDefaultTmdbAssetServerHost', h)
  }, host)
})
