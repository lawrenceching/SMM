import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useRenameMediaFolderMutation } from "./useRenameMediaFolderMutation"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { renameFolder } from "@/api/renameFolder"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { mediaMetadataQueryKey, normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
vi.mock("@/api/renameFolder", () => ({
  renameFolder: vi.fn().mockResolvedValue({}),
}))
vi.mock("@/stores/uiMediaFolderStore")

describe("useRenameMediaFolderMutation", () => {
  const path = "/media/show"
  const newName = "New"

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useUIMediaFolderStore).mockReturnValue({
      folders: [{ path, status: "idle", test: false }],
      setFolders: vi.fn(),
      setSelectedFolder: vi.fn(),
    } as unknown as ReturnType<typeof useUIMediaFolderStore>)
    vi.mocked(renameFolder).mockResolvedValue({})
  })

  it("renames folder and refreshes userConfig + mediaMetadata queries", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    queryClient.setQueryData(helloQueryKey, { userDataDir: "/data/dir", coreRoutesPort: 3001 })

    const removeQueriesSpy = vi.spyOn(queryClient, "removeQueries")
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries")
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useRenameMediaFolderMutation(), {
      wrapper,
    })

    await result.current.mutateAsync({ mediaFolderPath: path, newName })

    await waitFor(() => {
      expect(renameFolder).toHaveBeenCalledTimes(1)
    })
    expect(renameFolder).toHaveBeenCalledWith({
      from: path,
      to: "/media/New",
    })
    expect(removeQueriesSpy).toHaveBeenCalledWith({
      queryKey: mediaMetadataQueryKey(normalizeMediaFolderPathForQuery(path)),
    })
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: userConfigQueryKey("/data/dir"),
    })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: mediaMetadataQueryKey(normalizeMediaFolderPathForQuery("/media/New")),
    })
  })

  it("fails when folder is missing", async () => {
    vi.mocked(useUIMediaFolderStore).mockReturnValue({
      folders: [],
      setFolders: vi.fn(),
      setSelectedFolder: vi.fn(),
    } as unknown as ReturnType<typeof useUIMediaFolderStore>)
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useRenameMediaFolderMutation(), {
      wrapper,
    })

    await expect(
      result.current.mutateAsync({ mediaFolderPath: path, newName })
    ).rejects.toThrow(/Media folder not found/)
    expect(renameFolder).not.toHaveBeenCalled()
  })
})
