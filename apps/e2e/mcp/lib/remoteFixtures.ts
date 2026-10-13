import type { MediaMetadata } from '@smm/types'
import type { TestFolder } from '@smm/test'
import {
  containerTmpRoot,
  dockerCpDirToContainer,
  dockerRmContainerPath,
  newRemoteRunId,
} from './remoteDocker'
import { patchRemoteUserConfigFolders, writeRemoteMediaMetadata } from './remoteHttp'
import { buildMediaMetadataFromTemplate, setupTestMediaFolders } from './testSetup'

const TV_SHOW_METADATA_TEMPLATE = '天使降临到我身边.metadata.json'

export interface SeedRemoteMediaFolderOptions {
  container: string
  folder: TestFolder
}

export interface SeedRemoteRecognizedFolderContext {
  httpServerAddress: string
  authToken: string
  containerName: string
}

/**
 * Materialize a fixture on the host, `docker cp` it to
 * `/tmp/<runId>/media/<folderName>`, and return the container POSIX path.
 *
 * Copy target is `/tmp/<runId>/media` so `dockerCpDirToContainer` mkdir -p's
 * `/tmp/<runId>` (the parent of `containerDir`).
 */
export async function seedRemoteMediaFolder(opts: SeedRemoteMediaFolderOptions): Promise<{
  containerPath: string
  runId: string
  cleanup: () => Promise<void>
}> {
  const media = await setupTestMediaFolders()
  const created = media.materialize(opts.folder)
  const runId = newRemoteRunId()
  const containerMediaDir = `${containerTmpRoot(runId)}/media`
  const containerPath = `${containerMediaDir}/${created.folderName}`

  await dockerCpDirToContainer({
    container: opts.container,
    hostDir: media.mediaDir,
    containerDir: containerMediaDir,
  })

  return {
    containerPath,
    runId,
    cleanup: async () => {
      await media.cleanup()
      await dockerRmContainerPath({
        container: opts.container,
        containerPath: containerTmpRoot(runId),
      })
    },
  }
}

/**
 * Docker-copy a media folder, register it in remote user config, and seed
 * metadata over HTTP with `mediaFolderPath` set to the container POSIX path.
 */
export async function seedRemoteRecognizedFolder(
  ctx: SeedRemoteRecognizedFolderContext,
  folder: TestFolder,
  updateMediaMetadata?: (mediaMetadata: MediaMetadata) => MediaMetadata,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const seeded = await seedRemoteMediaFolder({
    container: ctx.containerName,
    folder,
  })
  const path = seeded.containerPath

  try {
    await patchRemoteUserConfigFolders(ctx.httpServerAddress, ctx.authToken, [path])
    const mediaMetadata = await buildMediaMetadataFromTemplate(
      { ...folder, path },
      TV_SHOW_METADATA_TEMPLATE,
      updateMediaMetadata,
    )
    await writeRemoteMediaMetadata(ctx.httpServerAddress, ctx.authToken, mediaMetadata)
  } catch (error) {
    await seeded.cleanup()
    throw error
  }

  return { path, cleanup: seeded.cleanup }
}
