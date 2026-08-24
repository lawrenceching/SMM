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

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useFoldersQuery', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('fetches folders when v3 is enabled by default', async () => {
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
