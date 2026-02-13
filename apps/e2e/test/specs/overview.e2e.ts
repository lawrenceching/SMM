import { expect } from '@wdio/globals'
import { before, beforeEach, afterEach } from 'mocha'
import StatusBar from '../componentobjects/StatusBar'
import Sidebar from '../componentobjects/Sidebar'
import { createBeforeHook } from '../lib/testbed'

describe('UI Components', () => {

    before(createBeforeHook())

    beforeEach(async () => {
        console.log('Setup before each test')
    })

    afterEach(async () => {
        console.log('Cleanup after each test')
    })

    it('StatusBar components are displayed', async () => {
        
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

    it('Sidebar components are displayed', async () => {
        // Verify Sidebar is displayed
        expect(await Sidebar.isDisplayed()).toBe(true)

        // Verify sort button is displayed
        expect(await Sidebar.isSortButtonDisplayed()).toBe(true)

        // Verify filter button is displayed
        expect(await Sidebar.isFilterButtonDisplayed()).toBe(true)

        // Verify search input is displayed
        expect(await Sidebar.isSearchInputDisplayed()).toBe(true)

        // Verify empty state message is displayed (no folders imported yet)
        expect(await Sidebar.isEmptyStateMessageDisplayed()).toBe(true)

        console.log('Sidebar components verified successfully')
    })
})
