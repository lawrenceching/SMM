import { expect } from '@wdio/globals'
import { registerStep, requiredStepArg } from '../lib/gherkin'

async function getEpisodeVideoCellText(episodeId: string): Promise<string> {
    const rowSelector = `//tr[.//td[contains(@class,"font-mono") and normalize-space()="${episodeId}"]]`
    const row = await $(rowSelector)
    const videoCell = await row.$('./td[2]')
    return (await videoCell.getText()).trim()
}

registerStep('episode "xxx" is linked to a video file', async (_ctx, args) => {
    const videoCellText = await getEpisodeVideoCellText(requiredStepArg(args, 0))
    expect(videoCellText).not.toBe('-')
})

registerStep('episode "xxx" is not linked to a video file', async (_ctx, args) => {
    const videoCellText = await getEpisodeVideoCellText(requiredStepArg(args, 0))
    expect(videoCellText).toBe('-')
})

const UNLINK_MENU_ITEM_LABELS = ['Unlink', '取消关联']

registerStep('"Unlink" episode context menu item is disabled', async () => {
    let unlinkItemDisabled = false
    for (const label of UNLINK_MENU_ITEM_LABELS) {
        const item = await $(`[role="menuitem"]=${label}`)
        if (await item.isDisplayed().catch(() => false)) {
            unlinkItemDisabled = await item.getAttribute('aria-disabled').then(v => v === 'true').catch(() => false)
            if (unlinkItemDisabled) break
        }
    }
    expect(unlinkItemDisabled).toBe(true)
})
