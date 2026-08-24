import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { HelloResponseBody } from "@core/types"
import { defaultUserConfig } from "@/api/readUserConfig"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"
import { foldersQueryKey } from "@/hooks/folders/foldersQueryKeys"
import { mediaMetadataQueryKey } from "@/lib/mediaMetadataQueryKeys"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { useUnimportFolderMutation } from "./useUnimportFolderMutation"

const USER_DATA_DIR = "/tmp/smm-user-data"
const PATH_A = "/media/A"
const PATH_B = "/media/B"

const unimportFolder = vi.fn()

vi.mock("@/api/unimportFolder", () => ({
  unimportFolder: (...args: unknown[]) => unimportFolder(...args),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function seedCaches(queryClient: QueryClient) {
  queryClient.setQueryData<HelloResponseBody>(helloQueryKey, {
    userDataDir: USER_DATA_DIR,
  } as HelloResponseBody)
  queryClient.setQueryData(userConfigQueryKey(USER_DATA_DIR), {
    ...defaultUserConfig,
    folders: [PATH_A, PATH_B],
  })
  queryClient.setQueryData(mediaMetadataQueryKey(PATH_A), {
    mediaFolderPath: PATH_A,
    status: "ok",
  })
}

describe("useUnimportFolderMutation", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    unimportFolder.mockResolvedValue({ data: { path: PATH_A } })
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    useUIMediaFolderStore.setState({
      folders: [
        { path: PATH_A, status: "ok" },
        { path: PATH_B, status: "ok" },
      ],
      selectedFolder: PATH_A,
      selectedFolders: [PATH_A],
    })
  })

  afterEach(() => {
    queryClient.clear()
    useUIMediaFolderStore.setState({
      folders: [],
      selectedFolder: "",
      selectedFolders: [],
    })
  })

  it("posts each path and invalidates folders query", async () => {
    seedCaches(queryClient)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useUnimportFolderMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync([PATH_A])
    })

    expect(unimportFolder).toHaveBeenCalledTimes(1)
    expect(unimportFolder).toHaveBeenCalledWith(PATH_A)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: foldersQueryKey })
    expect(queryClient.getQueryData(userConfigQueryKey(USER_DATA_DIR))).toEqual(
      expect.objectContaining({ folders: [PATH_B] }),
    )
    expect(useUIMediaFolderStore.getState().folders.map((f) => f.path)).toEqual([PATH_B])
  })

  it("does not call the API for an empty path list", async () => {
    seedCaches(queryClient)
    const { result } = renderHook(() => useUnimportFolderMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync([])
    })

    expect(unimportFolder).not.toHaveBeenCalled()
  })

  it("rolls back userConfig and Zustand when the API returns an error", async () => {
    seedCaches(queryClient)
    unimportFolder.mockResolvedValue({ error: "Error Reason: boom" })

    const { result } = renderHook(() => useUnimportFolderMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await expect(result.current.mutateAsync([PATH_A])).rejects.toThrow("Error Reason: boom")
    })

    expect(queryClient.getQueryData(userConfigQueryKey(USER_DATA_DIR))).toEqual(
      expect.objectContaining({ folders: [PATH_A, PATH_B] }),
    )
    expect(useUIMediaFolderStore.getState().folders.map((f) => f.path)).toEqual([PATH_A, PATH_B])
    expect(useUIMediaFolderStore.getState().selectedFolder).toBe(PATH_A)
  })
})
