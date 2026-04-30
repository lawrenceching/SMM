
import { browser } from '@wdio/globals'
import * as path from 'node:path'
import { setup, cleanup, importFolderWithMediaMetadata, isOfficialTmdbHostAccessible, isOfficialTvdbHostAccessible, isReverseProxyAccessible } from 'test/lib/testbed'
import { createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import type { UserConfig } from '@smm/core/types'
import Sidebar from 'test/componentobjects/Sidebar'
import TVShowPanel from 'test/componentobjects/TVShowPanel.co'
import env from 'test/lib/env'

describe('Custom TVDB Host', () => {

    before(async () => {
        const accessible = await isOfficialTvdbHostAccessible()
        if(!accessible) {
            throw new Error('Official TVDB host is not accessible')
        }
        const proxyAccessible = await isReverseProxyAccessible()
        if(!proxyAccessible) {
            throw new Error('Reverse proxy is not accessible — CLI proxy may have failed to start')
        }
    })

    beforeEach(async () => {

        const tvdbApiKey: string = process.env.TVDB_API_KEY || '';
        if (!tvdbApiKey || tvdbApiKey.trim() === '') {
            throw new Error('TMDB_API_KEY is not set');
        }

        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                config.tvdb = {
                    host: 'https://api4.thetvdb.com/v4',
                    apiKey: tvdbApiKey,
                }
                return config
            },
        })
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
        })
    })

    it('Search from custom TVDB host', async function () {
        this.timeout(90 * 1000)

        const folder = createFolderInTestFolder({
            ...folder1,
            files: [
                "S01E01.mkv",
            ],
        });

        await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
            mediaMetadata.mediaFiles = [
                {
                    absolutePath: path.join(folder.path!, folder.files[0]!),
                    seasonNumber: 1,
                    episodeNumber: 1,
                }
            ]
            if (mediaMetadata.tvShow !== undefined) {
                mediaMetadata.tvShow.database = 'TMDB'
                mediaMetadata.tvShow.id = '84666'
            }
            return mediaMetadata
        })

        await Sidebar.waitForFolderName(folder1.folderName);

        await TVShowPanel.searchbox.input.waitForDisplayed();
        await TVShowPanel.searchbox.input.click();
        await TVShowPanel.searchbox.setDatabase('TVDB')
        await TVShowPanel.searchbox.searchButton.click();

        await browser.waitUntil(
            async () => {
                const results = await TVShowPanel.searchbox.results
                const count = await results.length
                return count > 0
            },
            {
                timeout: 30000,
                interval: 500,
                timeoutMsg: 'TMDB search results did not appear within 30s',
            }
        )

        if(env.slowdown) {
            await browser.pause(5000);
        }
    })
})
