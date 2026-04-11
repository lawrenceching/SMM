import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useRenameMediaFolderMutation } from "./useRenameMediaFolderMutation"
import { doRenameFolder } from "@/lib/doRenameFolder"
import { useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
vi.mock("@/lib/doRenameFolder", () => ({
  doRenameFolder: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/stores/mediaMetadataStore")
vi.mock("@/actions/mediaMetadataActions")
vi.mock("@/hooks/mediaMetadata/useUpdateMediaMetadataMutation", () => ({
  useUpdateMediaMetadataMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe("useRenameMediaFolderMutation", () => {
  const path = "/media/show"
  const metadata = { mediaFolderPath: path, mediaName: "Show", status: "ok" as const, type: "tvshow-folder" as const }

  beforeEach(() => {
    vi.mocked(useMediaMetadataStoreActions).mockReturnValue({
      getMediaMetadata: vi.fn(() => metadata),
      addMediaMetadata: vi.fn(),
    } as unknown as ReturnType<typeof useMediaMetadataStoreActions>)
    vi.mocked(useMediaMetadataActions).mockReturnValue({
      deleteMediaMetadata: vi.fn(),
    } as unknown as ReturnType<typeof useMediaMetadataActions>)
    vi.mocked(doRenameFolder).mockClear()
  })

  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children)
    }
  }

  it("calls doRenameFolder when metadata exists", async () => {
    const { result } = renderHook(() => useRenameMediaFolderMutation(), {
      wrapper: createWrapper(),
    })

    await result.current.mutateAsync({ mediaFolderPath: path, newName: "New" })

    await waitFor(() => {
      expect(doRenameFolder).toHaveBeenCalledTimes(1)
    })
    expect(vi.mocked(doRenameFolder).mock.calls[0][0]).toBe(path)
    expect(vi.mocked(doRenameFolder).mock.calls[0][1]).toBe("New")
  })

  it("fails when metadata is missing", async () => {
    vi.mocked(useMediaMetadataStoreActions).mockReturnValue({
      getMediaMetadata: vi.fn(() => undefined),
    } as unknown as ReturnType<typeof useMediaMetadataStoreActions>)

    const { result } = renderHook(() => useRenameMediaFolderMutation(), {
      wrapper: createWrapper(),
    })

    await expect(
      result.current.mutateAsync({ mediaFolderPath: path, newName: "New" })
    ).rejects.toThrow(/Media metadata not found/)
    expect(doRenameFolder).not.toHaveBeenCalled()
  })
})
