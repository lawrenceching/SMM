import { expect } from '@wdio/globals'
import * as path from 'node:path'
import * as os from 'node:os'
import Sidebar from '../componentobjects/Sidebar'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const FOLDER_NAME = '古见同学有交流障碍症'

describe('TvShowPanel', () => {

    before(createBeforeHook({ 
        setupMediaFolders: true,
        userConfig: {
            folders: [path.join(os.tmpdir(), 'smm-test-media', 'media', FOLDER_NAME)]
        }
     }))

    it('should display TvShowPanel elements when folder is selected', async function() {
        // Wait for the folder to appear in the sidebar
        console.log(`Waiting for folder "${FOLDER_NAME}" to appear in sidebar...`)
        const isFolderDisplayed = await Sidebar.waitForFolder(FOLDER_NAME, 60000)
        expect(isFolderDisplayed).toBe(true)
        console.log(`Folder "${FOLDER_NAME}" is now displayed in sidebar`)

        // Click the folder to open TvShowPanel
        console.log(`Clicking folder "${FOLDER_NAME}" to open TvShowPanel...`)
        const folderElement = await Sidebar.getFolderByName(FOLDER_NAME)
        await folderElement.click()

        // Wait for TvShowPanel to load
        // The panel contains a div with class "p-1 w-full h-full relative"
        await delay(3000)

        // Verify TvShowPanel container is displayed
        const tvShowPanelContainer = $('div.p-1.w-full.h-full.relative')
        const isPanelDisplayed = await tvShowPanelContainer.isDisplayed()
        
        // Note: TvShowPanel may show loading state initially
        // We check that either the panel is displayed or loading is shown
        console.log(`TvShowPanel container displayed: ${isPanelDisplayed}`)

        // Check for the TMDBTVShowOverview component content
        // This could be in loading state (Skeleton) or loaded state
        const hasOverviewContent = await $('div.relative.w-full.h-full.flex.flex-col').isExisting()
        console.log(`TMDBTVShowOverview content found: ${hasOverviewContent}`)

        // Either the panel should be visible or we're in loading state
        expect(isPanelDisplayed || hasOverviewContent).toBe(true)

        // If panel is fully loaded, verify key elements
        if (isPanelDisplayed) {
            // Check for the overview component (poster image or skeleton)
            const hasPosterOrSkeleton = await $('img.rounded-lg.object-cover, div.rounded-lg.bg-muted').isExisting()
            console.log(`Poster or skeleton found: ${hasPosterOrSkeleton}`)
            
            // The panel should contain either content or loading state
            expect(hasPosterOrSkeleton || hasOverviewContent).toBe(true)
        }
    })
})
