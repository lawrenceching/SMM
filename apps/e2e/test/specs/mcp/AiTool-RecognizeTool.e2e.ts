import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../../componentobjects/Menu'
import { createBeforeHook, expectMediaMetadataToBe } from '../../lib/testbed'
import TVShowPanel from 'test/componentobjects/TVShowPanel.co'
import env from 'test/lib/env'
import { type MediaMetadata } from '@smm/core/types'
import { createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import { addFile, createTask, endTask } from 'test/lib/debugRecognizeTool'
import Prompts from 'test/componentobjects/Prompts'
import { Path } from '@smm/core'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

describe('AI Assistant - Recognize Tool', async () => {

    before(async () => {
        await createBeforeHook({ setupMediaFolders: false, setupMediaMetadata: false })();
    })

    after(async () => {
        if (fs.existsSync(tmpMediaRoot)) {
            fs.rmSync(tmpMediaRoot, { recursive: true, force: true })
            console.log('Removed tmp media folder:', tmpMediaRoot)
        }
    })
    
    it('Recognize TV Show episode files', async function() {
        if(env.slowdown) {
            this.timeout(5 * 60 * 1000)
        }

        const folder = await createFolderInTestFolder({
            folderName: folder1.folderName,
            mediaName: folder1.mediaName,
            type: 'tvshow',
            files: [
                '[1].mp4',
            ]
        })

        await Menu.importMediaFolder({
            type: 'tvshow',
            folderPathInPlatformFormat: folder.path!,
            traceId: 'e2eTest:Import Media Folder Search TV Show'
        })

        await Sidebar.waitForFolderName(folder.mediaName!, 60000)
        await TVShowPanel.waitForTable()

        await browser.waitUntil(async () => {
            return (await TVShowPanel.toString()).includes(`S01E01 - - - -`)
        }, {timeout: 5000})

        await expectMediaMetadataToBe(folder.path!, (obj) => {
            const mm = obj as MediaMetadata;
            return mm.mediaFiles === undefined || mm.mediaFiles.length === 0
        })

        // Simulate the AI Tool Recognize Episode Files
        // By sending HTTP request to recognize task debug API
        
        const { data } = await createTask({
            mediaFolderPath: folder.path!,
        })
        const taskId = data.taskId
        console.log(`Created task with ID: ${taskId}`)

        await addFile({
            taskId,
            season: 1,
            episode: 1,
            path: path.join(folder.path!, '[1].mp4'),
        })

        await endTask({
            taskId,
        })

        if(env.slowdown) {
            await browser.pause(10 * 1000)
        }

        await Prompts.aiBasedRecognizePrompt.waitForDisplayed();
        await Prompts.confirmButton.waitForDisplayed();

        if(env.slowdown) {
            await browser.pause(5000)
        }

        await Prompts.confirmButton.click();

        await browser.waitUntil(async () => {
            return (await TVShowPanel.toString()).includes(`S01E01 [1].mp4 - - -`)
        }, {timeout: 5000})

        await expectMediaMetadataToBe(folder.path!, (obj) => {
            const mm = obj as MediaMetadata;
            if(mm.mediaFiles === undefined || mm.mediaFiles.length === 0) {
                return false
            }
            const mediaFile = mm.mediaFiles[0]
            return mediaFile?.seasonNumber === 1 
                    && mediaFile?.episodeNumber === 1 
                    && mediaFile?.absolutePath === Path.posix(path.join(folder.path!, '[1].mp4'))
        })

        if(env.slowdown) {
            await browser.pause(2 * 60 * 1000)
        }        
    })

})
