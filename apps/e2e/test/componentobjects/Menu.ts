/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

interface ImportMediaFolderData {
    type: "tvshow" | "movie" | "music";
    folderPathInPlatformFormat: string;
    traceId?: string;
}

class Menu {
    /**
     * Get the app menubar
     */
    get menubar() {
        return $('[data-testid="app-menubar"]')
    }

    /**
     * Get the SMM menu trigger button
     */
    get smmMenuTrigger() {
        return $('[data-testid="menu-trigger-smm"]')
    }

    /**
     * Get the SMM menu content (dropdown)
     */
    get smmMenuContent() {
        return $('[data-testid="menu-content-smm"]')
    }

    /**
     * Get the Config menu item
     */
    get configMenuItem() {
        return $('[data-testid="menu-smm-config"]')
    }

    /**
     * Check if the menubar is displayed
     */
    async isMenubarDisplayed(): Promise<boolean> {
        return await this.menubar.isDisplayed()
    }

    /**
     * Click on the SMM menu trigger to open the dropdown
     */
    async clickSmmMenuTrigger(): Promise<void> {
        const trigger = await this.smmMenuTrigger
        await trigger.waitForClickable({ timeout: 5000 })
        await trigger.click()
    }

    /**
     * Check if the SMM menu content is displayed
     */
    async isSmmMenuContentDisplayed(): Promise<boolean> {
        try {
            const content = await this.smmMenuContent
            return await content.isDisplayed()
        } catch {
            return false
        }
    }

    /**
     * Wait for the SMM menu content to be displayed
     * @param timeout Timeout in milliseconds (default: 5000)
     */
    async waitForSmmMenuContent(timeout: number = 5000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return await this.isSmmMenuContentDisplayed()
        }, {
            timeout,
            timeoutMsg: `SMM menu content was not displayed after ${timeout}ms`
        })
    }

    /**
     * Click on the Config menu item
     */
    async clickConfigMenuItem(): Promise<void> {
        await this.waitForSmmMenuContent()
        // Wait for menu animation to complete
        await browser.pause(200)
        const item = await this.configMenuItem
        await item.waitForClickable({ timeout: 5000 })
        await item.click()
    }

    /**
     * Open the config dialog via menu (click SMM menu -> click Config)
     */
    async openConfigDialog(): Promise<void> {
        await this.clickSmmMenuTrigger()
        await this.clickConfigMenuItem()
    }

    /**
     * Import media folder via custom event
     */
    public async importMediaFolder(data: ImportMediaFolderData) {
        await browser.executeScript(`document.dispatchEvent(new CustomEvent('ui.mediaFolderImported', { detail: arguments[0] }))`, [data]);
    }
}

export default new Menu();