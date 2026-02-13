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
     * Check if background jobs indicator is displayed
     */
    async isBackgroundJobsIndicatorDisplayed(): Promise<boolean> {
        return await this.backgroundJobsIndicator.isDisplayed()
    }
}

export default new StatusBar();
