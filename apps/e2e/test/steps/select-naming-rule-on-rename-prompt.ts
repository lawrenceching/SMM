import { expect, browser } from '@wdio/globals'
import { registerStep, requiredStepArg } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'

const EMBY_PREVIEW_PATHS = [
    'Season 1/WATATEN an Angel Flew Down to Me S1E1 A Funny, Squirmy Feeling.mkv',
    'Season 1/WATATEN an Angel Flew Down to Me S1E2 Incontestably Cute.mkv',
    'Season 1/WATATEN an Angel Flew Down to Me S1E3 Imprinting.mkv',
]

registerStep('I select naming rule "xxx" on rename prompt', async (_ctx, args) => {
    const rule = requiredStepArg(args, 0)
    if (rule !== 'plex' && rule !== 'emby') {
        throw new Error(`Unsupported naming rule: ${rule}`)
    }
    await Prompts.selectNamingRule(rule)
})

registerStep('"Rename" prompt shows Emby-style preview paths', async () => {
    await browser.waitUntil(
        async () => {
            const paths = await TvShowPanelCO.newVideoFilePaths.map((i) => i.getText())
            return paths.length === 3 && paths[0]?.includes('Season 1/')
        },
        {
            timeout: 30000,
            interval: 500,
            timeoutMsg: 'Expected Emby-style rename preview paths in episode table',
        },
    )

    const newVideoFilePaths = await TvShowPanelCO.newVideoFilePaths.map((i) => i.getText())
    expect(newVideoFilePaths).toEqual(EMBY_PREVIEW_PATHS)
})
