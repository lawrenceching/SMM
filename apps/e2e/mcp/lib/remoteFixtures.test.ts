import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TestFolder } from '@smm/test'
import {
  dockerCpDirToContainer,
  dockerRmContainerPath,
  newRemoteRunId,
} from './remoteDocker'
import { patchRemoteUserConfigFolders, writeRemoteMediaMetadata } from './remoteHttp'
import { seedRemoteMediaFolder, seedRemoteRecognizedFolder } from './remoteFixtures'

vi.mock('./remoteDocker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./remoteDocker')>()
  return {
    ...actual,
    newRemoteRunId: vi.fn(() => 'run-fixed'),
    dockerCpDirToContainer: vi.fn(async () => {}),
    dockerRmContainerPath: vi.fn(async () => {}),
  }
})

vi.mock('./remoteHttp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./remoteHttp')>()
  return {
    ...actual,
    patchRemoteUserConfigFolders: vi.fn(async () => {}),
    writeRemoteMediaMetadata: vi.fn(async () => {}),
  }
})

const folder: TestFolder = {
  folderName: 'RemoteFixtureShow',
  files: ['S01E01.mkv'],
  type: 'tvshow',
}

describe('remoteFixtures', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.mocked(newRemoteRunId).mockReturnValue('run-fixed')
  })

  it('seedRemoteMediaFolder copies host mediaDir to /tmp/<runId>/media and returns container folder path', async () => {
    const seeded = await seedRemoteMediaFolder({
      container: 'smm',
      folder,
    })

    try {
      expect(seeded.runId).toBe('run-fixed')
      expect(seeded.containerPath).toBe('/tmp/run-fixed/media/RemoteFixtureShow')
      expect(dockerCpDirToContainer).toHaveBeenCalledTimes(1)
      const cp = vi.mocked(dockerCpDirToContainer).mock.calls[0]?.[0]
      expect(cp).toMatchObject({
        container: 'smm',
        containerDir: '/tmp/run-fixed/media',
      })
      expect(existsSync(join(cp!.hostDir, folder.folderName))).toBe(true)
    } finally {
      await seeded.cleanup()
    }
  })

  it('seedRemoteMediaFolder cleanup removes host temp and container /tmp/<runId>', async () => {
    const seeded = await seedRemoteMediaFolder({
      container: 'smm',
      folder,
    })
    const hostDir = vi.mocked(dockerCpDirToContainer).mock.calls[0]?.[0]?.hostDir
    expect(hostDir).toBeDefined()
    expect(existsSync(hostDir!)).toBe(true)

    await seeded.cleanup()

    expect(existsSync(hostDir!)).toBe(false)
    expect(dockerRmContainerPath).toHaveBeenCalledWith({
      container: 'smm',
      containerPath: '/tmp/run-fixed',
    })
  })

  it('seedRemoteRecognizedFolder patches user config and writes metadata at container path', async () => {
    const seeded = await seedRemoteRecognizedFolder(
      {
        httpServerAddress: 'http://127.0.0.1:30000',
        authToken: 'tok',
        containerName: 'smm',
      },
      folder,
      (mm) => {
        if (mm.tvShow) {
          mm.tvShow.name = 'Custom Name'
        }
        return mm
      },
    )

    try {
      expect(seeded.path).toBe('/tmp/run-fixed/media/RemoteFixtureShow')
      expect(dockerCpDirToContainer).toHaveBeenCalledTimes(1)
      expect(patchRemoteUserConfigFolders).toHaveBeenCalledWith(
        'http://127.0.0.1:30000',
        'tok',
        ['/tmp/run-fixed/media/RemoteFixtureShow'],
      )
      expect(writeRemoteMediaMetadata).toHaveBeenCalledTimes(1)
      const written = vi.mocked(writeRemoteMediaMetadata).mock.calls[0]
      expect(written?.[0]).toBe('http://127.0.0.1:30000')
      expect(written?.[1]).toBe('tok')
      expect(written?.[2]).toMatchObject({
        mediaFolderPath: '/tmp/run-fixed/media/RemoteFixtureShow',
        type: 'tvshow-folder',
        tvShow: expect.objectContaining({ name: 'Custom Name' }),
      })
      expect(written?.[2]?.mediaFiles?.[0]?.absolutePath).toBe(
        '/tmp/run-fixed/media/RemoteFixtureShow/S01E01.mkv',
      )
    } finally {
      await seeded.cleanup()
    }
  })
})
