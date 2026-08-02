import { expect, browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import Prompts from '../componentobjects/Prompts'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'

registerStep('"Rename" prompt is open', async (_ctx, _args) => {
    await Prompts.cancelButton.waitForDisplayed({ timeout: 10000 })

    await browser.waitUntil(
        async () => (await TvShowPanelCO.newVideoFilePaths.length) === 3,
        { timeout: 30000, interval: 500, timeoutMsg: 'Expected 3 rename preview paths in episode table' },
    )

    const newVideoFilePaths = await TvShowPanelCO.newVideoFilePaths.map(i => i.getText())
    expect(newVideoFilePaths).toEqual([
        'Season 01/WATATEN!: an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv',
        'Season 01/WATATEN!: an Angel Flew Down to Me - S01E02 - Incontestably Cute.mkv',
        'Season 01/WATATEN!: an Angel Flew Down to Me - S01E03 - Imprinting.mkv',
    ])
})
