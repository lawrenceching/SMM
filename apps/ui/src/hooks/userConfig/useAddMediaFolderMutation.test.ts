import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { HelloResponseBody } from "@core/types"
import { defaultUserConfig } from "@/api/readUserConfig"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"
import { foldersQueryKey } from "@/hooks/folders/foldersQueryKeys"
import { useAddMediaFolderMutation } from "./useAddMediaFolderMutation"

const USER_DATA_DIR = "/tmp/smm-user-data"
const NEW_FOLDER = "/media/new"

vi.mock("@/api/writeFile", () => ({
  writeFile: vi.fn().mockResolvedValue({ data: true, error: null }),
}))

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function seedUserConfigCache(queryClient: QueryClient, folders: string[] = []) {
  queryClient.setQueryData<HelloResponseBody>(helloQueryKey, {
    userDataDir: USER_DATA_DIR,
  } as HelloResponseBody)
  queryClient.setQueryData(userConfigQueryKey(USER_DATA_DIR), {
    ...defaultUserConfig,
    folders,
  })
}

describe("useAddMediaFolderMutation", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it("invalidates folders query when a new folder is added", async () => {
    seedUserConfigCache(queryClient)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useAddMediaFolderMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({ traceId: "t1", folder: NEW_FOLDER })
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: foldersQueryKey })
  })

  it("does not invalidate folders query when folder was already present", async () => {
    seedUserConfigCache(queryClient, [NEW_FOLDER])
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useAddMediaFolderMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({ traceId: "t1", folder: NEW_FOLDER })
    })

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
