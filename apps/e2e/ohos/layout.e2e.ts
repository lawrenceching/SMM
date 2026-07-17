import { browser, $, expect } from '@wdio/globals'
import Page from 'test/pageobjects/page'

describe('Layout - HarmonyOS Electron attach', () => {
    before(async () => {
        // Attach mode: app is already open — refresh and wait for _smm_status === 'ready'.
        await Page.refresh()
    })

    it('should render menu, sidebar and statusbar', async () => {
        await expect($('[data-testid="app-menubar"]')).toBeDisplayed()
        await expect($('[data-testid="sidebar-container"]')).toBeDisplayed()
        await expect($('[data-testid="status-bar"]')).toBeDisplayed()
    })

    it('should render statusbar components', async () => {
        const statusBar = $('[data-testid="status-bar"]')

        await expect(statusBar.$('[data-testid="connection-status-indicator"]')).toBeDisplayed()
        await expect(statusBar.$('[data-testid="status-bar-message"]')).toBeExisting()
        await expect(statusBar.$('[data-testid="mcp-toggle-button"]')).toBeDisplayed()
        await expect(statusBar.$('[data-testid="background-jobs-indicator"]')).toBeDisplayed()
        await expect(statusBar.$('[data-testid="app-version"]')).toBeDisplayed()

        const version = await statusBar.$('[data-testid="app-version"]').getText()
        console.log(`HarmonyOS Electron app version: "${version}"`)
        expect(version.trim().length).toBeGreaterThan(0)
    })
})
