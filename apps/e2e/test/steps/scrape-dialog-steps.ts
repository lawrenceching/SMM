import { expect, browser } from '@wdio/globals'
import { registerStep } from '../lib/gherkin'
import Sidebar from 'test/componentobjects/Sidebar'
import { TvShowPanelCO } from '../componentobjects/TVShowPanel.co'
import ScrapeDialogCO from '../componentobjects/ScrapeDialogCO'

async function clickScrapeButtonFromOverview(): Promise<void> {
    const scrapeButtonByTestId = $('[data-testid="scrape-button"]')
    if (await scrapeButtonByTestId.isExisting()) {
        await scrapeButtonByTestId.waitForClickable({ timeout: 5000 })
        await scrapeButtonByTestId.click()
        return
    }

    const labels = ['Scrape', '刮削']
    for (const label of labels) {
        const button = await $(`button=${label}`)
        if (await button.isDisplayed().catch(() => false)) {
            await button.waitForClickable({ timeout: 5000 })
            await button.click()
            return
        }
    }

    throw new Error('Scrape button not found in current panel')
}

async function clickFolderByAnyName(names: string[]): Promise<void> {
    await Sidebar.waitForFoldersToLoad(1, 10000)
    const deduped = Array.from(new Set(names.filter(Boolean)))
    for (const name of deduped) {
        if (await Sidebar.isFolderDisplayed(name)) {
            await Sidebar.clickFolder(name)
            return
        }
    }
    const existing = await Sidebar.getFolderNames()
    throw new Error(`Cannot find sidebar folder by names: ${deduped.join(', ')}. Existing folders: ${existing.join(', ')}`)
}

registerStep('folder from context was selected', async (ctx) => {
    const folder = ctx._folder as { folderName: string; translations?: { title?: Record<string, string> } }
    await clickFolderByAnyName([
        folder.folderName,
        folder.translations?.title?.['en-US'] ?? '',
        folder.translations?.title?.['zh-CN'] ?? '',
    ])
})

registerStep('I click "Scrape" button in TV show panel', async () => {
    await TvShowPanelCO.scrapeButton.waitForClickable()
    await TvShowPanelCO.scrapeButton.click()
})

registerStep('I click "Scrape" button in overview panel', async () => {
    await clickScrapeButtonFromOverview()
})

registerStep('scrape dialog shows all tasks pending', async () => {
    await ScrapeDialogCO.table.waitForDisplayed()
    expect(await ScrapeDialogCO.table.getText()).toContain(`File Status
Poster
Pending
Fanart
Pending
Episode Thumbnails
Pending
nfo
Pending`)
})

registerStep('scrape dialog shows movie tasks pending', async () => {
    await ScrapeDialogCO.table.waitForDisplayed()
    expect(await ScrapeDialogCO.table.getText()).toContain(`File Status
Poster
Pending
Fanart
Pending
nfo
Pending`)
})

registerStep('I start scrape', async () => {
    await ScrapeDialogCO.startButton.click()
})

registerStep('scrape dialog shows all TV show tasks completed', async () => {
    await browser.waitUntil(async () => {
        const text = await ScrapeDialogCO.table.getText()
        return text.includes(`File Status
Poster
Completed
Fanart
Completed
Episode Thumbnails
Completed
nfo
Completed`)
    }, {
        timeout: 40 * 1000,
        interval: 1000,
        timeoutMsg: 'ScrapeDialog did not show Completed status',
    })
})

registerStep('scrape dialog shows all TV show tasks failed', async () => {
    await browser.waitUntil(async () => {
        const ids = ['poster', 'fanart', 'thumbnails', 'nfo']
        const results = await Promise.all(ids.map(async (id) => {
            const el = $(`[data-testid="scrape-dialog-task-status-${id}"]`)
            return (await el.getAttribute('data-status')) === 'failed'
        }))
        return results.every(Boolean)
    }, {
        timeout: 60 * 1000,
        interval: 1000,
        timeoutMsg: 'ScrapeDialog tasks did not all fail',
    })
})

registerStep('scrape dialog shows movie tasks completed', async () => {
    await browser.waitUntil(async () => {
        const text = await ScrapeDialogCO.table.getText()
        return text.includes(`File Status
Poster
Completed
Fanart
Completed
nfo
Completed`)
    }, {
        timeout: 60 * 1000,
        interval: 1000,
        timeoutMsg: 'ScrapeDialog did not show Completed status',
    })
})

registerStep('I close scrape dialog', async () => {
    await ScrapeDialogCO.cancelButton.click()
})
