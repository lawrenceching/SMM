import * as path from 'node:path'
import { registerStep } from '../lib/gherkin'
import { createFolderInTestFolder, folder1, folder2, folder5 } from 'test/actions/import-folders'
import { importFolderWithMediaMetadata } from '../lib/testbed'
import page from 'test/pageobjects/page'
import Sidebar from 'test/componentobjects/Sidebar'

registerStep('TV show folder with TMDB id 84666 and one episode was imported', async (ctx) => {
    const folder = createFolderInTestFolder({
        ...folder1,
        files: ['S01E01.mkv'],
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

    ctx._folder = folder
    ctx._folderName = folder.folderName
    await page.open()
    await Sidebar.waitForFolderName(folder.folderName)
})

registerStep('TV show folder with TVDB id 355969 and one episode was imported', async (ctx) => {
    const folder = createFolderInTestFolder({
        ...folder1,
        files: ['S01E01.mkv'],
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
            mediaMetadata.tvShow.database = 'TVDB'
            mediaMetadata.tvShow.id = '355969'
        }
        return mediaMetadata
    })

    ctx._folder = folder
    ctx._folderName = folder.folderName
    await page.open()
    await Sidebar.waitForFolderName(folder.folderName)
})

registerStep('movie folder with TMDB id 552524 was imported', async (ctx) => {
    const folder = createFolderInTestFolder({
        ...folder2,
        folderName: '哪吒之魔童降世 (2019) {tmdbid=552524}',
        files: ['movie.mkv'],
    })

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
        mediaMetadata.type = 'movie-folder'
        mediaMetadata.tvShow = undefined
        mediaMetadata.mediaFiles = [
            {
                absolutePath: path.join(folder.path!, folder.files[0]!),
            },
        ]
        mediaMetadata.movie = {
            database: 'TMDB',
            id: '552524',
            name: '哪吒之魔童降世',
        }
        return mediaMetadata
    })

    ctx._folder = folder
    ctx._folderName = folder.folderName
    await page.open()
    await Sidebar.waitForFolderName(folder.folderName)
})

registerStep('movie folder with TVDB id 116 was imported', async (ctx) => {
    const folder = createFolderInTestFolder({
        ...folder5,
        files: ['The Dark Knight [1080P].mkv'],
    })

    await importFolderWithMediaMetadata(folder, '天使降临到我身边.metadata.json', (mediaMetadata) => {
        mediaMetadata.type = 'movie-folder'
        mediaMetadata.tvShow = undefined
        mediaMetadata.mediaFiles = [
            {
                absolutePath: path.join(folder.path!, folder.files[0]!),
            },
        ]
        mediaMetadata.movie = {
            database: 'TVDB',
            id: '116',
            name: folder5.translations?.title?.['en-US'] ?? 'The Dark Knight',
        }
        return mediaMetadata
    })

    ctx._folder = folder
    ctx._folderName = folder.folderName
    await page.open()
    await Sidebar.waitForFolderName(folder.folderName)
})
