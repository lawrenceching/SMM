/// <reference types="@wdio/globals/types" />

import { browser } from "@wdio/globals"

const DATA_ROW_SELECTOR = 'div[role="table"] > div[role="row"]'
const SUBTITLE_MENU_LABELS = ["Subtitle", "字幕"]

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

    get subtitleMenuButton() {
        return $('[data-testid="music-header-subtitle"]')
    }

    get contextMenus() {
        return $('[role="menu"]')
    }

    private async getTableRows() {
        return $$(DATA_ROW_SELECTOR)
    }

    private async resolveDataRow(index: number) {
        const rows = await this.getTableRows()
        const row = rows[index + 1]
        if (!row) {
            return null
        }
        const cells = await row.$$('[role="cell"]')
        if ((await cells.length) === 0) {
            return null
        }
        return row
    }

    async waitForDataRows(
        minCount: number,
        options?: { timeout?: number; interval?: number },
    ): Promise<void> {
        const timeout = options?.timeout ?? 30_000
        const interval = options?.interval ?? 500

        await browser.waitUntil(
            async () => {
                const rows = await this.getTableRows()
                const rowCount = await rows.length
                let dataRowCount = 0
                for (let i = 1; i < rowCount; i += 1) {
                    const cells = await rows[i]!.$$('[role="cell"]')
                    if ((await cells.length) > 0) {
                        dataRowCount += 1
                    }
                }
                return dataRowCount >= minCount
            },
            {
                timeout,
                interval,
                timeoutMsg: `[MusicPanel] Expected at least ${minCount} data row(s) after ${timeout}ms`,
            },
        )
    }

    /** Structured snapshot for diagnosing missing rows / multi-select UI. */
    async dumpDebugInfo(context?: string): Promise<void> {
        const tbodyRows = await $$("tbody tr")
        const roleTableRows = await this.getTableRows()

        const roleTableRowTexts: string[] = []
        for (const row of roleTableRows) {
            roleTableRowTexts.push((await row.getText()).trim())
        }

        const roleTableRowCount = await roleTableRows.length
        let dataRowCount = 0
        for (let i = 1; i < roleTableRowCount; i += 1) {
            const cells = await roleTableRows[i]!.$$('[role="cell"]')
            if ((await cells.length) > 0) {
                dataRowCount += 1
            }
        }

        const elementState = async (element: ReturnType<typeof $>) => ({
            exists: await element.isExisting().catch(() => false),
            displayed: await element.isDisplayed().catch(() => false),
            enabled: await element.isEnabled().catch(() => false),
        })

        const windowSize = await browser.getWindowSize().catch(() => ({ width: -1, height: -1 }))

        const debugInfo = {
            context: context ?? null,
            selectors: {
                tbodyTrCount: tbodyRows.length,
                roleTableRowCount,
                dataRowCount,
            },
            trackTitlesFromRoleTable: await this.getTrackRowTitles(),
            roleTableRowTexts,
            ui: {
                title: await elementState(this.title),
                selectButton: await elementState(this.selectButton),
                subtitleMenuButton: await elementState(this.subtitleMenuButton),
                transcribeButton: await elementState(this.transcribeButton),
                downloadButton: await elementState(this.downloadButton),
            },
            window: windowSize,
        }

        console.log(
            `[MusicPanel] debug info${context ? ` (${context})` : ""}:`,
            JSON.stringify(debugInfo, null, 2),
        )
    }

    async rightClick(index: number): Promise<void> {
        const row = await this.resolveDataRow(index)

        if (!row) {
            await this.dumpDebugInfo(`rightClick index=${index}`)
            throw new Error(`[MusicPanel] rightClick failed: data row index ${index} not found`)
        }

        await row.scrollIntoView()
        await row.waitForDisplayed({ timeout: 5000 })
        await row.click({ button: "right" })
    }

    async click(index: number): Promise<void> {
        const row = await this.resolveDataRow(index)

        if (!row) {
            await this.dumpDebugInfo(`click index=${index}`)
            throw new Error(`[MusicPanel] click failed: data row index ${index} not found`)
        }

        await row.scrollIntoView()
        await row.waitForDisplayed({ timeout: 5000 })
        await row.click()
    }

    async openSubtitleMenu(): Promise<void> {
        const button = await this.subtitleMenuButton
        await button.waitForClickable({ timeout: 10_000 })
        await button.click()
        await browser.pause(200)
    }

    async clickHeaderTranscribe(): Promise<void> {
        await this.openSubtitleMenu()
        const item = await this.transcribeButton
        await item.waitForClickable({ timeout: 5000 })
        await item.click()
    }

    async clickContextMenuSubtitleItem(item: MusicTrackContextMenuItem): Promise<void> {
        const labels = MUSIC_TRACK_CONTEXT_MENU_LABELS[item]

        await browser.waitUntil(
            async () => {
                for (const label of SUBTITLE_MENU_LABELS) {
                    const subTrigger = await $(`[role="menuitem"]=${label}`)
                    if (await subTrigger.isDisplayed().catch(() => false)) {
                        return true
                    }
                }
                return false
            },
            {
                timeout: 5000,
                interval: 200,
                timeoutMsg: `[MusicPanel] Subtitle submenu trigger [${SUBTITLE_MENU_LABELS.join(", ")}] did not appear`,
            },
        )

        for (const label of SUBTITLE_MENU_LABELS) {
            const subTrigger = await $(`[role="menuitem"]=${label}`)
            if (await subTrigger.isDisplayed().catch(() => false)) {
                await subTrigger.moveTo()
                await browser.pause(300)
                break
            }
        }

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
                timeoutMsg: `[MusicPanel] Subtitle context menu item [${labels.join(", ")}] did not appear`,
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

        throw new Error(`[MusicPanel] Subtitle context menu item [${labels.join(", ")}] not found`)
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

    /** Title column text for each data row (skips header / empty-state rows). */
    async getTrackRowTitles(): Promise<string[]> {
        const rows = await this.getTableRows()
        const titles: string[] = []

        const rowCount = await rows.length

        for (let i = 1; i < rowCount; i += 1) {
            const row = rows[i]!
            const cells = await row.$$('[role="cell"]')
            if ((await cells.length) < 3) {
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
                timeoutMsg: `[MusicPanel] No row title containing "${keyword}" after ${timeout}ms`,
            },
        )
    }
}

const MusicPanelCO = new MusicPanelComponentObject()
export default MusicPanelCO
