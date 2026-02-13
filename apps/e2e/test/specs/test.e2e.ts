/**
 * Template for E2E Test Files
 *
 * This file serves as a template/reference for creating new e2e tests.
 * Use the testbed module for common setup:
 *
 * - createBeforeHook() - Creates a before hook with common setup
 * - resetUserConfig() - Reset user config to default state
 * - setupTestMediaFolders() - Set up test media folders
 *
 * Example usage:
 * ```
 * import { before, beforeEach, afterEach } from 'mocha'
 * import { createBeforeHook } from '../lib/testbed'
 *
 * describe('My Tests', () => {
 *     before(createBeforeHook())
 *     beforeEach(async () => { ... })
 *     afterEach(async () => { ... })
 * })
 * ```
 */
import { browser } from '@wdio/globals'
import { before, beforeEach, afterEach } from 'mocha'
import { createBeforeHook, setupTestMediaFolders } from '../lib/testbed'

describe('AppV2 (Template)', () => {

    before(createBeforeHook({
        // Uncomment if you need test media folders:
        // setupMediaFolders: true
    }))

    beforeEach(async () => {
        console.log('Setup before each test')
    })

    afterEach(async () => {
        console.log('Cleanup after each test')
    })

    // ========================================================================
    // EXAMPLE TEST - Copy and modify for your needs
    // ========================================================================

    it('Example Test', async () => {
        // Example: Test StatusBar is displayed
        // const { default: StatusBar } = await import('../componentobjects/StatusBar')
        // await browser.waitUntil(async () => {
        //     return await StatusBar.isDisplayed()
        // }, {
        //     timeout: 10000,
        //     timeoutMsg: 'Status bar was not displayed after 10 seconds'
        // })
        // expect(await StatusBar.isDisplayed()).toBe(true)
    })
})
