/// <reference types="@wdio/globals/types" />

import { browser } from "@wdio/globals"

type MusicTrackContextMenuItem =
    | "downloadStart"
    | "downloadStop"
    | "downloadRemove"
    | "open"
    | "properties"
    | "formatConvert"
    | "transcribe"
    | "delete"

const MUSIC_TRACK_CONTEXT_MENU_LABELS: Record<MusicTrackContextMenuItem, string[]> = {
    downloadStart: ["Start", "开始"],
    downloadStop: ["Stop", "停止"],
    downloadRemove: ["Remove", "删除"],
    open: ["Open", "打开"],
    properties: ["Properties", "属性"],
    formatConvert: ["Format conversion", "格式转换"],
    transcribe: ["Transcribe", "转录"],
    delete: ["Delete", "删除"],
}

class MusicPanelComponentObject {
    get title() {
        return $('[data-testid="music-panel-title"]')
    }

    get selectButton() {
        return $('[data-testid="music-multi-select-toggle"]')
    }

    get transcribeButton() {
        return $('[data-testid="music-multi-select-transcribe"]')
    }

    get downloadButton() {
        return $('[data-testid="music-download-button"]')
    }

    get contextMenus() {
        return $('[role="menu"]')
    }

    async rightClick(index: number): Promise<void> {
        const rows = await $$("tbody tr")
        const row = rows[index]

        if (!row) {
            throw new Error(`[MusicPanel] rightClick failed: row index ${index} not found, total rows: ${rows.length}`)
        }

        await row.scrollIntoView()
        await row.waitForDisplayed({ timeout: 5000 })
        await row.click({ button: "right" })
    }

    async click(index: number): Promise<void> {
        const rows = await $$("tbody tr")
        const row = rows[index]

        if (!row) {
            throw new Error(`[MusicPanel] rightClick failed: row index ${index} not found, total rows: ${rows.length}`)
        }

        await row.scrollIntoView()
        await row.waitForDisplayed({ timeout: 5000 })
        await row.click()
    }

    async clickContextMenu(item: MusicTrackContextMenuItem): Promise<void> {
        const labels = MUSIC_TRACK_CONTEXT_MENU_LABELS[item]

        await browser.waitUntil(
            async () => {
                for (const label of labels) {
                    const menuItem = await $(`[role="menuitem"]=${label}`)
                    if (await menuItem.isDisplayed().catch(() => false)) {
                        return true
                    }
                }
                return false
            },
            {
                timeout: 5000,
                interval: 200,
                timeoutMsg: `[MusicPanel] Context menu item [${labels.join(", ")}] did not appear`,
            },
        )

        for (const label of labels) {
            const menuItem = await $(`[role="menuitem"]=${label}`)
            if (await menuItem.isDisplayed().catch(() => false)) {
                await menuItem.waitForClickable({ timeout: 3000 })
                await menuItem.click()
                return
            }
        }

        throw new Error(`[MusicPanel] Context menu item [${labels.join(", ")}] not found`)
    }

    /** Title column text for each data row (skips empty-state placeholder row). */
    async getTrackRowTitles(): Promise<string[]> {
        const rows = await $$("tbody tr")
        const titles: string[] = []

        for (const row of rows) {
            const cells = await row.$$("td")
            if ((await cells.length) < 4) {
                continue
            }
            const titleCell = cells[2]
            if (titleCell) {
                titles.push((await titleCell.getText()).trim())
            }
        }

        return titles
    }

    async waitForRowTitleContaining(
        keyword: string,
        options?: { timeout?: number; interval?: number },
    ): Promise<void> {
        const timeout = options?.timeout ?? 120_000
        const interval = options?.interval ?? 1000

        await browser.waitUntil(
            async () => {
                const titles = await this.getTrackRowTitles()
                return titles.some((title) => title.includes(keyword))
            },
            {
                timeout,
                interval,
                timeoutMsg: async () => {
                    const titles = await this.getTrackRowTitles()
                    const displayed = titles.length > 0 ? titles.join(" | ") : "(no data rows)"
                    return `[MusicPanel] No row title containing "${keyword}" after ${timeout}ms. Titles: ${displayed}`
                },
            },
        )
    }
}

const MusicPanelCO = new MusicPanelComponentObject()
export default MusicPanelCO
