import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getJobViaCoreMock, getFoldersMock } = vi.hoisted(() => ({
  getJobViaCoreMock: vi.fn(),
  getFoldersMock: vi.fn(),
}))

vi.mock('@/api/getJob', () => ({
  getJobViaCore: getJobViaCoreMock,
}))

vi.mock('@/api/getFolders', () => ({
  getFolders: getFoldersMock,
}))

import {
  importLibraryTaskStatusToUiStatus,
  waitForLibraryFoldersRegistered,
} from './importLibraryV3'

describe('importLibraryTaskStatusToUiStatus', () => {
  it('maps task status to sidebar folder status', () => {
    expect(importLibraryTaskStatusToUiStatus('pending')).toBe('pending_for_initialization')
    expect(importLibraryTaskStatusToUiStatus('running')).toBe('initializing')
    expect(importLibraryTaskStatusToUiStatus('succeeded')).toBe('ok')
    expect(importLibraryTaskStatusToUiStatus('failed')).toBe('error_loading_metadata')
  })
})

describe('waitForLibraryFoldersRegistered', () => {
  beforeEach(() => {
    getJobViaCoreMock.mockReset()
    getFoldersMock.mockReset()
  })

  it('returns folder paths once they appear in UserConfig', async () => {
    getJobViaCoreMock
      .mockResolvedValueOnce({
        kind: 'import-library',
        tasks: [{ id: 't0', path: '/lib/A', status: 'pending' }],
        status: 'pending',
      })
      .mockResolvedValue({
        kind: 'import-library',
        tasks: [{ id: 't0', path: '/lib/A', status: 'pending' }],
        status: 'pending',
      })
    getFoldersMock
      .mockResolvedValueOnce({ data: { folders: [] } })
      .mockResolvedValue({ data: { folders: ['/lib/A'] } })

    const paths = await waitForLibraryFoldersRegistered('job-1')

    expect(paths).toEqual(['/lib/A'])
    expect(getFoldersMock).toHaveBeenCalled()
  })

  it('returns empty paths when the job fails before registration', async () => {
    getJobViaCoreMock.mockResolvedValue({
      kind: 'import-library',
      tasks: [],
      status: 'failed',
    })

    const paths = await waitForLibraryFoldersRegistered('job-1')

    expect(paths).toEqual([])
    expect(getFoldersMock).not.toHaveBeenCalled()
  })

  it('returns empty paths when the library has no subfolders', async () => {
    getJobViaCoreMock.mockResolvedValue({
      kind: 'import-library',
      tasks: [],
      status: 'succeeded',
    })

    const paths = await waitForLibraryFoldersRegistered('job-1')

    expect(paths).toEqual([])
  })
})
