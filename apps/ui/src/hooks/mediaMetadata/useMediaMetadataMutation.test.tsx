import type { PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { MediaMetadata, ProblemDetails } from "@smm/types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  MetadataHttpError,
  createMetadata,
  deleteMetadata,
  getMetadata,
  setMetadata,
} from "@/api/metadata"
import {
  mediaMetadataQueryKey,
  normalizeMediaFolderPathForQuery,
} from "@/lib/mediaMetadataQueryKeys"
import { useMediaMetadataMutation } from "./useMediaMetadataMutation"
import { useMediaMetadataQuery } from "./useMediaMetadataQuery"
import { useUpdateMediaMetadataMutation } from "./useUpdateMediaMetadataMutation"

vi.mock("@/api/metadata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/metadata")>()
  return {
    ...actual,
    createMetadata: vi.fn(),
    deleteMetadata: vi.fn(),
    getMetadata: vi.fn(),
    setMetadata: vi.fn(),
  }
})

const metadata: MediaMetadata = {
  mediaFolderPath: "/media/show",
  type: "tvshow-folder",
  mediaFiles: [],
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe("metadata hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("maps a metadata 404 to query data null", async () => {
    const problem: ProblemDetails = {
      type: "https://smm/errors/metadata-not-found",
      title: "Metadata not found",
      status: 404,
      detail: "Missing",
      instance: "/api/get-metadata",
    }
    vi.mocked(getMetadata).mockRejectedValue(new MetadataHttpError(problem, 404))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { result } = renderHook(
      () => useMediaMetadataQuery("C:\\media\\show"),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it("create and set update the normalized metadata cache", async () => {
    vi.mocked(createMetadata).mockResolvedValue(metadata)
    const updated = { ...metadata, type: "movie-folder" as const }
    vi.mocked(setMetadata).mockResolvedValue(updated)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useMediaMetadataMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() => result.current.create(metadata))
    expect(queryClient.getQueryData(mediaMetadataQueryKey("/media/show"))).toEqual(metadata)

    await act(() =>
      result.current.set("C:\\media\\show", {
        type: "movie-folder",
        mediaFiles: [],
      }),
    )
    const windowsPathKey = mediaMetadataQueryKey(
      normalizeMediaFolderPathForQuery("C:\\media\\show"),
    )
    expect(queryClient.getQueryData(windowsPathKey)).toEqual(updated)
  })

  it("preserves live folder files when setMetadata returns persisted metadata", async () => {
    const withFiles = {
      ...metadata,
      files: ["/media/show/S01E01.mkv"],
    }
    const persisted = {
      ...metadata,
      mediaFiles: [
        {
          absolutePath: "/media/show/S01E01.mkv",
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    }
    vi.mocked(setMetadata).mockResolvedValue(persisted)
    const queryClient = new QueryClient()
    queryClient.setQueryData(mediaMetadataQueryKey("/media/show"), withFiles)
    const { result } = renderHook(() => useMediaMetadataMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() =>
      result.current.set("/media/show", {
        mediaFiles: persisted.mediaFiles,
      }),
    )

    expect(queryClient.getQueryData(mediaMetadataQueryKey("/media/show"))).toEqual({
      ...persisted,
      files: ["/media/show/S01E01.mkv"],
    })
  })

  it("preserves files from the metadata being saved when the cache is empty", async () => {
    const incoming = {
      ...metadata,
      files: ["/media/show/S01E01.mkv"],
      mediaFiles: [
        {
          absolutePath: "/media/show/S01E01.mkv",
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    }
    const persisted = {
      mediaFolderPath: incoming.mediaFolderPath,
      type: incoming.type,
      mediaFiles: incoming.mediaFiles,
    }
    vi.mocked(setMetadata).mockResolvedValue(persisted)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useUpdateMediaMetadataMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() => result.current.persistMediaMetadata("/media/show", incoming))

    expect(queryClient.getQueryData(mediaMetadataQueryKey("/media/show"))).toEqual({
      ...persisted,
      files: ["/media/show/S01E01.mkv"],
    })
  })

  it("remove clears the normalized metadata cache", async () => {
    vi.mocked(deleteMetadata).mockResolvedValue()
    const queryClient = new QueryClient()
    const windowsPathKey = mediaMetadataQueryKey(
      normalizeMediaFolderPathForQuery("C:\\media\\show"),
    )
    queryClient.setQueryData(windowsPathKey, metadata)
    const { result } = renderHook(() => useMediaMetadataMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() => result.current.remove("C:\\media\\show"))

    expect(queryClient.getQueryData(windowsPathKey)).toBeNull()
  })
})
