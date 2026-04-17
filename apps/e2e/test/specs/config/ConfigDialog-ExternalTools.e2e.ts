import { expect, browser } from '@wdio/globals'
import Menu from '../../componentobjects/Menu'
import ConfigDialog from '../../componentobjects/ConfigDialog'
import StatusBar from '../../componentobjects/StatusBar'
import Page from '../../pageobjects/page'
import { createBeforeHook } from '../../lib/testbed'
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

    describe('External Tools - Display Executable Paths and Versions', () => {
        it('should display yt-dlp and ffmpeg executable paths and their versions', async function() {
            this.timeout(120 * 1000)
            
            console.log('Opening config dialog...')
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()
            expect(await ConfigDialog.isDisplayed()).toBe(true)

            ConfigDialog.ytdlpPathInput.scrollIntoView()
            ConfigDialog.ytdlpPathInput.waitForDisplayed()
            ConfigDialog.ffmpegPathInput.waitForDisplayed()
            ConfigDialog.ytdlpVersion.waitForDisplayed()
            ConfigDialog.ffmpegVersion.waitForDisplayed()

            await browser.waitUntil(async () => {
                const ytdlpPath = await ConfigDialog.ytdlpPathInput.getValue() as string
                const ffmpegPath = await ConfigDialog.ffmpegPathInput.getValue() as string
                const ytdlpVersion = await ConfigDialog.ytdlpVersion.getText() as string
                const ffmpegVersion = await ConfigDialog.ffmpegVersion.getText() as string

                console.log(`yt-dlp path: ${ytdlpPath}`)
                console.log(`ffmpeg path: ${ffmpegPath}`)
                console.log(`yt-dlp version: ${ytdlpVersion}`)
                console.log(`ffmpeg version: ${ffmpegVersion}`)
                
                return ytdlpPath.length > 0 
                && ffmpegPath.length > 0 
                && ytdlpVersion.length > 0 
                && ffmpegVersion.length > 0
            }, {
                timeout: 10000,
                interval: 500
            })
        })
    })
})
