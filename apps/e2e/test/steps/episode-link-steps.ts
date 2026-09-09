import { expect } from '@wdio/globals'
import { registerStep, requiredStepArg } from '../lib/gherkin'

/**
 * Read the Video File cell for an episode row.
 *
 * MediaFileTable nests episode `<tr>`s inside a season wrapper `<tr>` that also
 * contains the SxxExx id as a descendant. Prefer locating the id `<td>` then
 * walking to its parent row (same approach as TvShowPanelCO), instead of an
 * XPath that matches the outer wrapper (which only has one `td` and breaks
 * `./td[2]`).
 *
 * Column order: `[checkbox?] [SxxExx] [video] [thumb] [sub] [nfo]`.
 */
async function getEpisodeVideoCellText(episodeId: string): Promise<string> {
    const idCell = await $(`td=${episodeId}`)
    await idCell.waitForDisplayed({ timeout: 10000 })
    const row = await idCell.parentElement()
    const cells = await row.$$('td')
    let idCellIndex = -1
    for (let i = 0; i < cells.length; i++) {
        const text = (await cells[i]!.getText()).trim()
        if (text === episodeId) {
            idCellIndex = i
            break
        }
    }
    if (idCellIndex < 0 || idCellIndex + 1 >= cells.length) {
        throw new Error(
            `Video file cell not found for episode "${episodeId}" (idCellIndex=${idCellIndex}, cells=${cells.length})`,
        )
    }
    return (await cells[idCellIndex + 1]!.getText()).trim()
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
