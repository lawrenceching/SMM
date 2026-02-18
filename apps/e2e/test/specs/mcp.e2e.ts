import { expect } from '@wdio/globals'
import { browser } from '@wdio/globals'
import StatusBar from '../componentobjects/StatusBar'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

describe('MCP Server', () => {

    before(createBeforeHook())

    it('should toggle MCP server and verify connectivity', async function() {
        // 1. Click MCP toggle button to open popover
        await StatusBar.clickMcpToggle()
        
        // Wait for popover to open
        const isPopoverOpen = await StatusBar.waitForMcpPopover(5000)
        expect(isPopoverOpen).toBe(true)

        // 2. Click MCP switch to enable MCP server
        await StatusBar.clickMcpSwitch()
        
        // Wait for MCP server to start
        await delay(2000)

        // 3. Get MCP address from the page
        const mcpAddress = await StatusBar.getMcpAddress()
        console.log(`MCP Address: ${mcpAddress}`)
        expect(mcpAddress).toContain('http://')

        // 4. Verify MCP server is running by fetching the address
        const isMcpRunning = await browser.executeAsync(async (address, done) => {
            try {
                const response = await fetch(address, { 
                    method: 'GET',
                    mode: 'no-cors'
                })
                // With no-cors, response.ok will be true even if server exists
                done(true)
            } catch {
                done(false)
            }
        }, mcpAddress)
        
        // The MCP server should be running (no-cors returns true even if server exists)
        expect(isMcpRunning).toBe(true)

        // 5. Click MCP switch again to disable MCP server
        await StatusBar.clickMcpSwitch()
        
        // Wait for MCP server to stop
        await delay(2000)

        // 6. Verify MCP server is not running
        const isMcpStopped = await browser.executeAsync(async (address, done) => {
            try {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 2000)
                
                await fetch(address, { 
                    method: 'GET',
                    signal: controller.signal
                })
                clearTimeout(timeoutId)
                done(true) // Server still running
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    // Connection timeout - server is not responding
                    done(false)
                } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    // Network error - server is not running
                    done(false)
                } else {
                    done(false)
                }
            }
        }, mcpAddress)
        
        expect(isMcpStopped).toBe(false)
    })
})
