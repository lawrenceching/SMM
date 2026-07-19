import { registerStep } from '../lib/gherkin'
import { folder1, folder4, type TestFolder } from 'test/actions/import-folders'
import { createAndImportFolderViaBrowser } from 'test/lib/browser-fs'

const PREDEFINED: Record<string, TestFolder> = {
    [folder1.folderName]: folder1,
    [folder4.folderName]: folder4,
}

/**
 * Creates a media folder by matching the folder name against predefined definitions
 * in test/actions/import-folders.ts (folder1, folder4, etc.) and imports it.
 * The folder name should contain `{tmdbid=...}` or `{tvdbid=...}` to trigger recognition.
 */
registerStep('Import media folder "xxx"', async (ctx, args) => {
    const [folderName] = args
    const def = PREDEFINED[folderName!]
    if (!def) {
        throw new Error(
            `No predefined folder found for "${folderName}". ` +
            `Available: ${Object.keys(PREDEFINED).join(', ')}`
        )
    }
    const folderPath = await createAndImportFolderViaBrowser(
        def,
        'e2eTest:ImportMediaFolder',
    )
    ctx._folder = { ...def, path: folderPath }
    ctx._folderName = folderName
})

/**
 * Creates and imports a media folder from a custom TestFolder definition.
 * Set `ctx._importFolderDef` to a TestFolder before calling this step
 * (or pass the definition as the second arg to `when`).
 *
 * Usage:
 *   await when('Import media folder', { ...folder1, folderName: 'My Folder {tvdbid=123}' })
 */
registerStep('Import media folder', async (ctx) => {
    const def = ctx._importFolderDef as TestFolder | undefined
    if (!def) {
        throw new Error(
            'No folder definition found. ' +
            'Set ctx._importFolderDef to a TestFolder before calling this step.'
        )
    }
    const folderPath = await createAndImportFolderViaBrowser(
        def,
        'e2eTest:ImportMediaFolder',
    )
    ctx._folder = { ...def, path: folderPath }
    ctx._folderName = def.folderName
})
