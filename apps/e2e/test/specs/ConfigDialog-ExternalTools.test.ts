import { expect, browser } from '@wdio/globals'
import Menu from '../componentobjects/Menu'
import ConfigDialog from '../componentobjects/ConfigDialog'
import StatusBar from '../componentobjects/StatusBar'
import Page from '../pageobjects/page'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

describe('Config Dialog - External Tools', () => {
    before(async () => {
        await createBeforeHook({ setupMediaFolders: false })()
    })

    beforeEach(async () => {
        await Page.refresh()
        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after page reload'
        })
        await browser.pause(500)
        console.log('Page reloaded and ready')
    })

    /**
     * Helper function to reload page and wait for it to be ready
     */
    async function reloadAndWaitForReady(): Promise<void> {
        await Page.refresh()
        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after page reload'
        })
        await browser.pause(500)
        console.log('Page reloaded and ready')
    }

    describe('External Tools - Display Executable Paths and Versions', () => {
        it('should display yt-dlp and ffmpeg executable paths and their versions', async function() {
            if (slowdown) {
                this.timeout(120 * 1000)
            }

            // Step1: Open config dialog
            console.log('Opening config dialog...')
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()
            expect(await ConfigDialog.isDisplayed()).toBe(true)

            if (slowdown) {
                await delay(1000)
            }

            // Step 2: Verify yt-dlp executable path is displayed
            console.log('Verifying yt-dlp executable path is displayed...')
            const ytdlpPath = await ConfigDialog.getYtdlpPath()
            console.log(`yt-dlp path: ${ytdlpPath}`)
            
            // Assert 1: yt-dlp executable path should be displayed
            expect(ytdlpPath.length).toBeGreaterThan(0)
            console.log('✓ Assert 1: yt-dlp executable path is displayed on screen')

            if (slowdown) {
                await delay(1000)
            }

            // Step 3: Verify ffmpeg executable path is displayed
            console.log('Verifying ffmpeg executable path is displayed...')
            const ffmpegPath = await ConfigDialog.getFfmpegPath()
            console.log(`ffmpeg path: ${ffmpegPath}`)
            
            // Assert 1: ffmpeg executable path should be displayed
            expect(ffmpegPath.length).toBeGreaterThan(0)
            console.log('✓ Assert 1: ffmpeg executable path is displayed on screen')

            if (slowdown) {
                await delay(1000)
            }

            // Step 4: Wait for async API calls to complete and verify yt-dlp version is displayed
            console.log('Waiting for yt-dlp version to be loaded (async API call)...')
            
            // Wait for version text to appear (API calls are async)
            await browser.waitUntil(async () => {
                const hasVersion = await ConfigDialog.isYtdlpVersionDisplayed()
                return hasVersion
            }, {
                timeout: 15000, // Give enough time for async API calls
                timeoutMsg: 'yt-dlp version was not displayed after API call'
            })

            const ytdlpVersion = await ConfigDialog.getYtdlpVersion()
            console.log(`yt-dlp version: ${ytdlpVersion}`)
            
            // Assert 2: yt-dlp version should be displayed
            expect(ytdlpVersion).toContain('Version:')
            expect(ytdlpVersion.length).toBeGreaterThan(10) // Version string should have some content
            console.log('✓ Assert 2: yt-dlp version is displayed on screen')

            if (slowdown) {
                await delay(1000)
            }

            // Step 5: Wait for async API calls to complete and verify ffmpeg version is displayed
            console.log('Waiting for ffmpeg version to be loaded (async API call)...')
            
            await browser.waitUntil(async () => {
                const hasVersion = await ConfigDialog.isFfmpegVersionDisplayed()
                return hasVersion
            }, {
                timeout: 15000, // Give enough time for async API calls
                timeoutMsg: 'ffmpeg version was not displayed after API call'
            })

            const ffmpegVersion = await ConfigDialog.getFfmpegVersion()
            console.log(`ffmpeg version: ${ffmpegVersion}`)
            
            // Assert 2: ffmpeg version should be displayed
            expect(ffmpegVersion).toContain('Version:')
            expect(ffmpegVersion.length).toBeGreaterThan(10) // Version string should have some content
            console.log('✓ Assert 2: ffmpeg version is displayed on screen')

            if (slowdown) {
                await delay(1000)
            }

            console.log('External tools test completed successfully')
        })
    })
})
