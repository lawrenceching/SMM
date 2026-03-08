import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../componentobjects/Menu'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

describe.skip('Assistant - listFiles tool', () => {
    const FOLDER_NAME = 'ListFilesTestFolder'
    const EXPECTED_FILES = ['test1.mp4', 'test2.mp4']

    before(async () => {
        await createBeforeHook({ setupMediaFolders: true, setupMediaMetadata: false })()
    })

    afterEach(async () => {
        if (fs.existsSync(tmpMediaRoot)) {
            fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
            console.log('Removed tmp media folder:', tmpMediaRoot)
        }
    })

    it('lists files in media folder when user asks in Assistant', async function () {
        this.timeout(90 * 1000)

        const testMediaFolder = path.join(mediaDir, FOLDER_NAME)
        fs.mkdirSync(testMediaFolder, { recursive: true })
        for (const f of EXPECTED_FILES) {
            fs.writeFileSync(path.join(testMediaFolder, f), '')
        }
        console.log('Created media folder with files:', testMediaFolder, EXPECTED_FILES)

        await Menu.importMediaFolder({
            type: 'tvshow',
            folderPathInPlatformFormat: testMediaFolder,
            traceId: 'e2eTest:Assistant listFiles',
        })
        await delay(3 * 1000)

        const assistantButton = await browser.$('button.aui-modal-button')
        await assistantButton.waitForDisplayed({ timeout: 10000 })
        await assistantButton.click()
        await delay(1000)

        const composerInput = await browser.$('textarea.aui-composer-input')
        await composerInput.waitForDisplayed({ timeout: 10000 })
        const userMessage = `Call listFiles tool to list files in media ${FOLDER_NAME}`
        await composerInput.setValue(userMessage)
        await delay(500)

        const sendButton = await browser.$('button.aui-composer-send')
        await sendButton.waitForDisplayed({ timeout: 10000 })
        await sendButton.click()

        const assistantMessage = await browser.$('div.aui-assistant-message-root[data-role="assistant"]')
        await browser.waitUntil(
            async () => {
                const el = await assistantMessage
                if (!(await el.isDisplayed())) return false
                const text = await el.getText()
                const hasAnyExpectedFile = EXPECTED_FILES.some((name) => text.includes(name))
                if (hasAnyExpectedFile) {
                    console.log('Assistant response contains expected filename(s):', text.substring(0, 200) + '...')
                    return true
                }
                return false
            },
            {
                timeout: 60000,
                interval: 2000,
                timeoutMsg: `AI response did not contain any of [${EXPECTED_FILES.join(', ')}] within 60s`,
            }
        )

        const responseText = await assistantMessage.getText()
        const hasExpectedFile = EXPECTED_FILES.some((name) => responseText.includes(name))
        expect(hasExpectedFile).toBe(true)
    })
})
