/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

class Sidebar {
    /**
     * Get the sidebar container
     */
    get sidebarContainer() {
        return $('[data-testid="sidebar-container"]')
    }

    /**
     * Get the sidebar toolbar containing sort/filter controls
     */
    get sidebarToolbar() {
        return $('[data-testid="sidebar-toolbar"]')
    }

    /**
     * Get the sort select trigger button
     */
    get sortSelectTrigger() {
        return $('[data-testid="sort-select-trigger"]')
    }

    /**
     * Get the filter select trigger button
     */
    get filterSelectTrigger() {
        return $('[data-testid="filter-select-trigger"]')
    }

    /**
     * Get the sort select content (dropdown)
     */
    get sortSelectContent() {
        return $('[data-testid="sort-select-content"]')
    }

    /**
     * Get the alphabetical sort option
     */
    get sortOptionAlphabetical() {
        return $('[data-testid="sort-option-alphabetical"]')
    }

    /**
     * Get the reverse alphabetical sort option
     */
    get sortOptionReverseAlphabetical() {
        return $('[data-testid="sort-option-reverse-alphabetical"]')
    }

    /**
     * Get the folder list container
     */
    get folderList() {
        return $('[data-testid="sidebar-folder-list"]')
    }

    /**
     * Get the folder items container
     */
    get folderItemsContainer() {
        return $('[data-testid="sidebar-folder-items"]')
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
        const emptyMessage = $('[data-testid="sidebar-empty-state"]')
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
        // Use the sidebar container as indicator
        const sidebar = $('[data-testid="sidebar-container"]')
        return await sidebar.isExisting()
    }

    /**
     * Check if the sort button (ArrowUpDown icon) is displayed
     */
    async isSortButtonDisplayed(): Promise<boolean> {
        const sortButton = $('[data-testid="sort-select-trigger"]')
        return await sortButton.isExisting()
    }

    /**
     * Check if the filter button (Filter icon) is displayed
     */
    async isFilterButtonDisplayed(): Promise<boolean> {
        const filterButton = $('[data-testid="filter-select-trigger"]')
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
        const emptyMessage = $('[data-testid="sidebar-empty-state"]')
        return await emptyMessage.isExisting()
    }

    /**
     * Get the search input element
     */
    async getSearchInput(): Promise<ChainablePromiseElement> {
        return $('input[placeholder="搜索媒体文件夹..."]')
    }

    /**
     * Click the sort select trigger to open the dropdown
     */
    async clickSortSelect(): Promise<void> {
        const trigger = await $('[data-testid="sort-select-trigger"]')
        await trigger.waitForClickable({ timeout: 5000 })
        await trigger.click()
    }

    /**
     * Select alphabetical sort order
     */
    async selectAlphabeticalSort(): Promise<void> {
        await this.clickSortSelect()
        const option = await $('[data-testid="sort-option-alphabetical"]')
        await option.waitForClickable({ timeout: 5000 })
        await option.click()
    }

    /**
     * Select reverse alphabetical sort order
     */
    async selectReverseAlphabeticalSort(): Promise<void> {
        await this.clickSortSelect()
        const option = await $('[data-testid="sort-option-reverse-alphabetical"]')
        await option.waitForClickable({ timeout: 5000 })
        await option.click()
    }

    /**
     * Get all folder names in the sidebar in their current order
     * @returns Array of folder names in display order
     */
    async getFolderNamesInOrder(): Promise<string[]> {
        const folderItems = await $$('[data-testid^="sidebar-folder-item-"] h5')
        const names: string[] = []

        for (const item of folderItems) {
            const text = await item.getText()
            names.push(text)
        }

        return names
    }

    /**
     * Get the number of folders displayed in the sidebar
     */
    async getFolderCount(): Promise<number> {
        const folderItems = await $$('[data-testid^="sidebar-folder-item-"]')
        return folderItems.length
    }

    /**
     * Wait for folders to be loaded in the sidebar
     * @param minCount Minimum number of folders expected (default: 1)
     * @param timeout Timeout in milliseconds (default: 30000)
     */
    async waitForFoldersToLoad(minCount: number = 1, timeout: number = 30000): Promise<boolean> {
        return await browser.waitUntil(async () => {
            const count = await this.getFolderCount()
            return count >= minCount
        }, {
            timeout,
            timeoutMsg: `Expected at least ${minCount} folders to be loaded in sidebar after ${timeout}ms`
        })
    }
}

export default new Sidebar()
