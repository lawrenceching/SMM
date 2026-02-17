class StatusBar {
    /**
     * Get the main status bar element
     */
    get statusBar() {
        return $('[data-testid="status-bar"]')
    }

    /**
     * Get the connection status indicator element
     */
    get connectionStatusIndicator() {
        return $('[data-testid="connection-status-indicator"]')
    }

    /**
     * Get the MCP toggle button element
     */
    get mcpToggleButton() {
        return $('[data-testid="mcp-toggle-button"]')
    }

    /**
     * Get the background jobs indicator element
     */
    get backgroundJobsIndicator() {
        return $('[data-testid="background-jobs-indicator"]')
    }

    /**
     * Get the app version element
     */
    get appVersion() {
        return $('[data-testid="app-version"]')
    }

    /**
     * Get the background jobs trigger button (inside indicator)
     */
    get backgroundJobsTriggerButton() {
        return $('[data-testid="background-jobs-trigger-button"]')
    }

    /**
     * Get the background jobs count element
     */
    get backgroundJobsCount() {
        return $('[data-testid="background-jobs-count"]')
    }

    /**
     * Get the background jobs popover content
     */
    get backgroundJobsPopover() {
        return $('[data-testid="background-jobs-list"]')
    }

    /**
     * Get the background jobs popover header
     */
    get backgroundJobsPopoverHeader() {
        return $('[data-testid="background-jobs-header"]')
    }

    /**
     * Get the background jobs popover title
     */
    get backgroundJobsPopoverTitle() {
        return $('[data-testid="background-jobs-title"]')
    }

    /**
     * Get running jobs count text from popover
     */
    get backgroundJobsRunningCount() {
        return $('[data-testid="background-jobs-subtitle"]')
    }

    /**
     * Get all background job items in the popover
     */
    get backgroundJobItems() {
        return $$('[data-testid^="background-job-"]')
    }

    /**
     * Get background job item by ID
     */
    backgroundJobItem(jobId: string) {
        return $(`[data-testid="background-job-${jobId}"]`)
    }

    /**
     * Get abort button for a specific job by ID
     */
    backgroundJobAbortButton(jobId: string) {
        return $(`[data-testid="background-job-${jobId}-abort-button"]`)
    }

    /**
     * Get job status badge by job ID
     */
    backgroundJobStatusBadge(jobId: string) {
        return $(`[data-testid="background-job-${jobId}-status-badge"]`)
    }

    /**
     * Check if the status bar is displayed
     */
    async isDisplayed(): Promise<boolean> {
        return await this.statusBar.isDisplayed()
    }

    /**
     * Get the app version text
     */
    async getVersion(): Promise<string> {
        return await this.appVersion.getText()
    }

    /**
     * Click the MCP toggle button
     */
    async clickMcpToggle(): Promise<void> {
        await this.mcpToggleButton.click()
    }

    /**
     * Check if connection status indicator is displayed
     */
    async isConnectionStatusDisplayed(): Promise<boolean> {
        return await this.connectionStatusIndicator.isDisplayed()
    }

    /**
     * Check if MCP toggle button is displayed
     */
    async isMcpToggleDisplayed(): Promise<boolean> {
        return await this.mcpToggleButton.isDisplayed()
    }

    /**
     * Get the MCP popover element
     */
    get mcpPopover() {
        return $('[data-testid="mcp-popover"]')
    }

    /**
     * Get the MCP address link element
     */
    get mcpAddressLink() {
        return $('[data-testid="mcp-address"]')
    }

    /**
     * Get the MCP switch button element
     */
    get mcpSwitch() {
        return $('[data-testid="mcp-switch"]')
    }

    /**
     * Check if MCP popover is open
     */
    async isMcpPopoverOpen(): Promise<boolean> {
        try {
            return await this.mcpPopover.isDisplayed()
        } catch {
            return false
        }
    }

    /**
     * Get MCP address text
     */
    async getMcpAddress(): Promise<string> {
        return await this.mcpAddressLink.getText()
    }

    /**
     * Click MCP switch to toggle MCP server
     */
    async clickMcpSwitch(): Promise<void> {
        await this.mcpSwitch.click()
    }

    /**
     * Wait for MCP popover to appear
     */
    async waitForMcpPopover(timeout: number = 5000): Promise<boolean> {
        try {
            await this.mcpPopover.waitForDisplayed({ timeout })
            return true
        } catch {
            return false
        }
    }

    /**
     * Check if background jobs indicator is displayed
     */
    async isBackgroundJobsIndicatorDisplayed(): Promise<boolean> {
        return await this.backgroundJobsIndicator.isDisplayed()
    }

    /**
     * Click the background jobs indicator to open popover
     */
    async clickBackgroundJobsIndicator(): Promise<void> {
        await this.backgroundJobsTriggerButton.click()
    }

    /**
     * Get background jobs indicator text (running count or completed count)
     */
    async getBackgroundJobsIndicatorText(): Promise<string> {
        const button = await this.backgroundJobsTriggerButton
        return await button.getText()
    }

    /**
     * Check if background jobs popover is open
     */
    async isBackgroundJobsPopoverOpen(): Promise<boolean> {
        try {
            const popover = await this.backgroundJobsPopover
            return await popover.isDisplayed()
        } catch {
            return false
        }
    }

    /**
     * Get the background jobs popover title text
     */
    async getBackgroundJobsPopoverTitle(): Promise<string> {
        return await this.backgroundJobsPopoverTitle.getText()
    }

    /**
     * Get running and pending jobs count from popover subtitle
     */
    async getBackgroundJobsCounts(): Promise<{ running: number; pending: number }> {
        const text = await this.backgroundJobsRunningCount.getText()
        const runningMatch = text.match(/(\d+)\s*running/)
        const pendingMatch = text.match(/(\d+)\s*pending/)
        return {
            running: runningMatch && runningMatch[1] ? parseInt(runningMatch[1], 10) : 0,
            pending: pendingMatch && pendingMatch[1] ? parseInt(pendingMatch[1], 10) : 0
        }
    }

    /**
     * Get the number of background job items displayed
     */
    async getBackgroundJobItemsCount(): Promise<number> {
        return await this.backgroundJobItems.length
    }

    /**
     * Click abort button for a specific job by ID
     */
    async abortBackgroundJob(jobId: string): Promise<void> {
        const abortBtn = await this.backgroundJobAbortButton(jobId)
        await abortBtn.click()
    }

    /**
     * Wait for background jobs popover to appear
     */
    async waitForBackgroundJobsPopover(timeout: number = 5000): Promise<boolean> {
        try {
            await this.backgroundJobsPopover.waitForDisplayed({ timeout })
            return true
        } catch {
            return false
        }
    }

    /**
     * Get the displayed message in the status bar
     */
    async getMessage(): Promise<string> {
        const messageElement = await $('[data-testid="status-bar-message"]')
        return await messageElement.getText()
    }

    /**
     * Check if the status bar message contains the given text
     * @param text The text to search for
     */
    async messageContains(text: string): Promise<boolean> {
        const message = await this.getMessage()
        return message.includes(text)
    }
}

export default new StatusBar();
