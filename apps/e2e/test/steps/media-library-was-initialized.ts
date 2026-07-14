import * as path from 'node:path'
import * as fs from 'node:fs'
import { registerStep } from '../lib/gherkin'
import { createFolderInTestFolder, folder1, folder2 } from 'test/actions/import-folders'
import { importMediaLibrary } from 'test/actions/events'

interface InitializedFolder {
    folderName: string
    path: string
    type: string
}

registerStep('Media library was imported with TV show folders', async (ctx) => {
    const folders: InitializedFolder[] = []

    const unknownFolder = createFolderInTestFolder({
        ...folder1,
        folderName: 'UnknownFolder',
    })
    folders.push({ folderName: 'UnknownFolder', path: unknownFolder.path!, type: 'tvshow-folder' })

    const folderByName = createFolderInTestFolder(folder1)
    folders.push({ folderName: folder1.folderName, path: folderByName.path!, type: 'tvshow-folder' })

    const folderByTmdbId = createFolderInTestFolder({
        ...folder1,
        folderName: '{tmdbid=84666}',
    })
    folders.push({ folderName: '{tmdbid=84666}', path: folderByTmdbId.path!, type: 'tvshow-folder' })

    const folderByNfo = createFolderInTestFolder({
        ...folder1,
        folderName: 'FolderContainsTvShowNfo',
    })
    const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>天使降临到我身边</title>
  <id>84666</id>
  <tmdbid>84666</tmdbid>
</tvshow>`
    fs.writeFileSync(path.join(folderByNfo.path!, 'tvshow.nfo'), nfoXml)
    folders.push({ folderName: 'FolderContainsTvShowNfo', path: folderByNfo.path!, type: 'tvshow-folder' })

    const mediaFolder = path.dirname(folders[0]!.path)

    await importMediaLibrary({
        libraryPathInPlatformFormat: mediaFolder,
        type: 'tvshow',
        traceId: 'e2e:Import Media Library:Import TV Show Library',
    })

    ctx._folders = folders
})

registerStep('Media library was imported with movie folders', async (ctx) => {
    const folders: InitializedFolder[] = []

    const unknownFolder = createFolderInTestFolder({
        ...folder2,
        folderName: 'UnknownFolder',
    })
    folders.push({ folderName: 'UnknownFolder', path: unknownFolder.path!, type: 'movie-folder' })

    const folderByName = createFolderInTestFolder(folder2)
    folders.push({ folderName: folder2.folderName, path: folderByName.path!, type: 'movie-folder' })

    const folderByTmdbId = createFolderInTestFolder({
        ...folder2,
        folderName: '{tmdbid=1539104}',
    })
    folders.push({ folderName: '{tmdbid=1539104}', path: folderByTmdbId.path!, type: 'movie-folder' })

    const folderByNfo = createFolderInTestFolder({
        ...folder2,
        folderName: 'FolderContainsMovieNfo',
    })
    const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>咒术回战 涩谷事变×死灭回游 剧场版</title>
  <id>1539104</id>
  <tmdbid>1539104</tmdbid>
</movie>`
    fs.writeFileSync(path.join(folderByNfo.path!, 'movie.nfo'), nfoXml)
    folders.push({ folderName: 'FolderContainsMovieNfo', path: folderByNfo.path!, type: 'movie-folder' })

    const mediaFolder = path.dirname(folders[0]!.path)

    await importMediaLibrary({
        libraryPathInPlatformFormat: mediaFolder,
        type: 'movie',
        traceId: 'e2e:Import Media Library:Import Movie Library',
    })

    ctx._folders = folders
})
