import { expect, browser } from '@wdio/globals'
import Menu from '../componentobjects/Menu'
import ConfigDialog from '../componentobjects/ConfigDialog'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

describe('Open Config Dialog', () => {

    before(async () => {
        await createBeforeHook({ setupMediaFolders: false })()
    })

    it('should open config dialog via SMM menu', async function() {
        if(slowdown) {
            this.timeout(60 * 1000)
        }

        // Verify the menubar is displayed
        console.log('Checking if menubar is displayed...')
        const menubarDisplayed = await Menu.isMenubarDisplayed()
        expect(menubarDisplayed).toBe(true)
        console.log('Menubar is displayed')

        if(slowdown) {
            await delay(1 * 1000)
        }

        // Click on the SMM menu trigger to open the dropdown
        console.log('Clicking SMM menu trigger...')
        await Menu.clickSmmMenuTrigger()

        if(slowdown) {
            await delay(1 * 1000)
        }

        // Verify the SMM menu content is displayed
        console.log('Verifying SMM menu content is displayed...')
        const menuContentDisplayed = await Menu.waitForSmmMenuContent()
        expect(menuContentDisplayed).toBe(true)
        console.log('SMM menu content is displayed')

        if(slowdown) {
            await delay(1 * 1000)
        }

        // Click on the Config menu item
        console.log('Clicking Config menu item...')
        await Menu.clickConfigMenuItem()

        if(slowdown) {
            await delay(1 * 1000)
        }

        // Verify the config dialog is displayed
        console.log('Verifying config dialog is displayed...')
        const dialogDisplayed = await ConfigDialog.waitForDisplayed()
        expect(dialogDisplayed).toBe(true)
        console.log('Config dialog is displayed')

        if(slowdown) {
            await delay(3 * 1000)
        }

        // Close the config dialog
        console.log('Closing config dialog...')
        await ConfigDialog.pressEscape()

        // Verify the config dialog is closed
        await ConfigDialog.waitForClosed()
        console.log('Config dialog closed')

        if(slowdown) {
            await delay(2 * 1000)
        }

        console.log('Config dialog test completed successfully')
    })

    it('should open config dialog using openConfigDialog helper method', async function() {
        if(slowdown) {
            this.timeout(60 * 1000)
        }

        // Use the helper method to open config dialog
        console.log('Opening config dialog using helper method...')
        await Menu.openConfigDialog()

        if(slowdown) {
            await delay(1 * 1000)
        }

        // Verify the config dialog is displayed
        const dialogDisplayed = await ConfigDialog.waitForDisplayed()
        expect(dialogDisplayed).toBe(true)
        console.log('Config dialog is displayed')

        if(slowdown) {
            await delay(3 * 1000)
        }

        // Close the config dialog
        console.log('Closing config dialog...')
        await ConfigDialog.pressEscape()
        await ConfigDialog.waitForClosed()
        console.log('Config dialog closed')

        if(slowdown) {
            await delay(2 * 1000)
        }

        console.log('Helper method test completed successfully')
    })
})
