import * as path from 'node:path'
import { registerStep } from '../lib/gherkin'
import { createFolderInTestFolder, folder1 } from 'test/actions/import-folders'
import { importFolderWithMediaMetadata } from 'test/lib/testbed'
import Sidebar from 'test/componentobjects/Sidebar'

/**
 * Imports a TV show folder with one episode and TMDB id 84666 metadata. The
 * folder is created with `S01E01.mkv` and the metadata template is set to
 * point to TMDB id 84666 (the "Wataten" TV show). This is the canonical
 * folder used by the TMDB/TVDB search tests in the `manual/` suite.
 */
registerStep('TV show folder with TMDB id 84666 and one episode was imported', async () => {
    const folder = createFolderInTestFolder({
        ...folder1,
        files: [
            'S01E01.mkv',
        ],
    })

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
        mediaMetadata.mediaFiles = [
            {
                absolutePath: path.join(folder.path!, folder.files[0]!),
                seasonNumber: 1,
                episodeNumber: 1,
            },
        ]
        if (mediaMetadata.tvShow !== undefined) {
            mediaMetadata.tvShow.database = 'TMDB'
            mediaMetadata.tvShow.id = '84666'
        }
        return mediaMetadata
    })

    await Sidebar.waitForFolderName(folder.folderName)
})
