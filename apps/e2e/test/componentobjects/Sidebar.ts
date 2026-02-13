/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

class Sidebar {
    /**
     * Get the sidebar container - use class-based selector since data-testid is not set
     */
    get sidebarContainer() {
        // Sidebar is the flex container with h-full w-full in the main content area
        // We look for the sidebar that contains the toolbar with sort/filter buttons
        return $('div.flex.flex-col.h-full.w-full')
    }

    /**
     * Get the sidebar container using a more specific selector
     * This targets the sidebar within the main content area
     */
    get sidebarContainerByContent() {
        // Look for the container that has both the toolbar (sort/filter) and search
        return $('main + * div.flex.flex-col.h-full.w-full')
    }

    /**
     * Find a folder item by name within the sidebar
     * The folder name is displayed in an h5 element within each folder item div
     * @param folderName The name of the folder to find
     */
    async getFolderByName(folderName: string): Promise<ChainablePromiseElement> {
        // Use xpath to find h5 elements containing the folder name
        const folderElement = $(`//div[contains(@class, 'group') and contains(@class, 'relative')]//h5[text()="${folderName}"]`)
        
        // Wait for the element to exist
        await folderElement.waitForExist({ timeout: 5000 })
        
        return folderElement
    }

    /**
     * Check if a folder with the given name exists in the sidebar
     * @param folderName The name of the folder to check
     */
    async isFolderDisplayed(folderName: string): Promise<boolean> {
        try {
            const element = $(`//div[contains(@class, 'group') and contains(@class, 'relative')]//h5[text()="${folderName}"]`)
            return await element.isExisting()
        } catch {
            return false
        }
    }

    /**
     * Wait for a folder to appear in the sidebar
     * @param folderName The name of the folder to wait for
     * @param timeout Timeout in milliseconds (default: 30000)
     */
    async waitForFolder(folderName: string, timeout: number = 30000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return await this.isFolderDisplayed(folderName)
        }, {
            timeout,
            timeoutMsg: `Folder "${folderName}" was not displayed in sidebar after ${timeout}ms`
        })
    }

    /**
     * Check if the sidebar is in its initial state (no folders displayed)
     * The initial state shows "没有找到媒体文件夹" message
     */
    async isInInitialState(): Promise<boolean> {
        // Check for the empty state message
        const emptyMessage = $('div.p-4.text-center.text-muted-foreground.text-sm')
        return await emptyMessage.isExisting()
    }

    /**
     * Wait for sidebar to be in initial state (no folders displayed)
     * @param timeout Timeout in milliseconds (default: 5000)
     */
    async waitForInitialState(timeout: number = 5000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            return await this.isInInitialState()
        }, {
            timeout,
            timeoutMsg: `Sidebar was not in initial state after ${timeout}ms`
        })
    }

    /**
     * Check if the Sidebar is displayed
     * Uses the search input as a reliable indicator since it's always in the sidebar
     */
    async isDisplayed(): Promise<boolean> {
        // Use the search input as indicator - it always exists in sidebar
        const searchInput = $('input[placeholder="搜索媒体文件夹..."]')
        return await searchInput.isExisting()
    }

    /**
     * Check if the sort button (ArrowUpDown icon) is displayed
     */
    async isSortButtonDisplayed(): Promise<boolean> {
        // Look for the button with sr-only text "排序" (Sort)
        const sortButton = $(`//button[.//span[text()="排序"]]`)
        return await sortButton.isExisting()
    }

    /**
     * Check if the filter button (Filter icon) is displayed
     */
    async isFilterButtonDisplayed(): Promise<boolean> {
        // Look for the button with sr-only text "筛选" (Filter)
        const filterButton = $(`//button[.//span[text()="筛选"]]`)
        return await filterButton.isExisting()
    }

    /**
     * Check if the search input is displayed
     */
    async isSearchInputDisplayed(): Promise<boolean> {
        // Search input has placeholder "搜索媒体文件夹..."
        const searchInput = $('input[placeholder="搜索媒体文件夹..."]')
        return await searchInput.isExisting()
    }

    /**
     * Check if the empty state message is displayed
     */
    async isEmptyStateMessageDisplayed(): Promise<boolean> {
        const emptyMessage = $('div.p-4.text-center.text-muted-foreground.text-sm')
        return await emptyMessage.isExisting()
    }

    /**
     * Get the search input element
     */
    async getSearchInput(): Promise<ChainablePromiseElement> {
        return $('input[placeholder="搜索媒体文件夹..."]')
    }
}

export default new Sidebar()
