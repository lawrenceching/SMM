import { browser, expect } from '@wdio/globals'
import { before, beforeEach, afterEach } from 'mocha'
import StatusBar from '../componentobjects/StatusBar'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

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
})
