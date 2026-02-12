import { browser, expect } from '@wdio/globals'
import Menu from '../componentobjects/Menu'
import Page from '../pageobjects/page'
import StatusBar from '../componentobjects/StatusBar'

describe('AppV2', () => {

    // Runs before each test in this describe block
    beforeEach(async () => {
        console.log('Setup before each test')
        // Navigate to base state if needed
    })

     // Runs after each test in this describe block
     afterEach(async () => {
        console.log('Cleanup after each test')
    })



    it('UI Components', async () => {
        Page.open()

        // Wait for the app to load
        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after 10 seconds'
        })

        // Verify StatusBar is displayed
        expect(await StatusBar.isDisplayed()).toBe(true)

        // Verify connection status indicator is displayed
        expect(await StatusBar.isConnectionStatusDisplayed()).toBe(true)

        // Verify MCP toggle button is displayed
        expect(await StatusBar.isMcpToggleDisplayed()).toBe(true)

        // Verify background jobs indicator is displayed
        expect(await StatusBar.isBackgroundJobsIndicatorDisplayed()).toBe(true)

        // Verify app version is displayed and contains text
        const version = await StatusBar.getVersion()
        expect(version).toBeTruthy()
        expect(version.length).toBeGreaterThan(0)

        console.log('App version:', version)
    })
})

