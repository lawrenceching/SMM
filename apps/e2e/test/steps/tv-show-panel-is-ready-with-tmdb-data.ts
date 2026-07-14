import { browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'

const RENAME_BUTTON_LABELS = ['Rename', '重命名']

registerStep('TV show panel is ready with TMDB data', async () => {
    await browser.waitUntil(
        async () => {
            for (const label of RENAME_BUTTON_LABELS) {
                const btn = await $(`button=${label}`)
                if (await btn.isDisplayed().catch(() => false)) return true
            }
            return false
        },
        { timeout: 30000, interval: 500, timeoutMsg: 'Rename button did not appear in TV show header' },
    )
    await TvShowPanelCO.waitForTable(10000)
})
