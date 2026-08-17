import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { useFoldersQuery } from './useFoldersQuery'
import * as getFoldersApi from '@/api/getFolders'

vi.mock('@/api/getFolders', () => ({
  getFolders: vi.fn(),
}))

const mockedGetFolders = vi.mocked(getFoldersApi.getFolders)

const STORAGE_KEY_SMM_V3_ENABLED = 'smm.v3.enabled'

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useFoldersQuery', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.removeItem(STORAGE_KEY_SMM_V3_ENABLED)
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY_SMM_V3_ENABLED)
    queryClient.clear()
  })

  it('does not call getFolders when smm.v3.enabled is unset', async () => {
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => useFoldersQuery(), { wrapper })

    await new Promise((r) => setTimeout(r, 20))

    expect(mockedGetFolders).not.toHaveBeenCalled()
    expect(result.current.isFetching).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches folders when smm.v3.enabled is true', async () => {
    localStorage.setItem(STORAGE_KEY_SMM_V3_ENABLED, 'true')
    mockedGetFolders.mockResolvedValue({
      data: { folders: ['/media/a', '/media/b'] },
    })

    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => useFoldersQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockedGetFolders).toHaveBeenCalled()
    expect(result.current.data).toEqual(['/media/a', '/media/b'])
  })
})
