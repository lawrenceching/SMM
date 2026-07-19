import { registerStep } from '../lib/gherkin'
import { importMediaFolder } from 'test/actions/events'

/**
 * Dispatch `ui.mediaFolderImported` for a folder that already exists on the
 * HarmonyOS device (no host-side fixture creation).
 *
 * Defaults to `tvshow`. Override via `ctx._folderType` (`tvshow` | `movie` | `music`).
 */
registerStep('Import folder "xxx" in HarmonyOS', async (ctx, args) => {
    const [folderPath] = args
    if (!folderPath) {
        throw new Error('Import folder in HarmonyOS: folder path is empty')
    }

    const type =
        (ctx._folderType as 'tvshow' | 'movie' | 'music' | undefined) ?? 'tvshow'

    await importMediaFolder({
        type,
        folderPathInPlatformFormat: folderPath,
        traceId: 'e2eTest:ImportFolderInHarmonyOS',
    })

    const folderName = folderPath.split(/[/\\]/).filter(Boolean).pop() ?? folderPath
    ctx._folder = { path: folderPath, folderName }
    ctx._folderName = folderName
})
