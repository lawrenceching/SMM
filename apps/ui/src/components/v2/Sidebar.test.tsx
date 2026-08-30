import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { MediaMetadata } from "@smm/types"
import { Path } from "@smm/utils/path"
import { basename } from "@/lib/path"
import { Sidebar } from "./Sidebar"

vi.mock("@tanstack/react-query", () => ({
  useQueries: vi.fn(),
}))

vi.mock("@/hooks/folders", () => ({
  useFoldersQuery: vi.fn(() => ({ data: undefined, isFetching: false })),
  useUnimportFolderMutation: vi.fn(() => ({ mutateAsync: vi.fn() })),
}))

vi.mock("@/components/search-form", () => ({
  SearchForm: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="search-form">{placeholder}</div>
  ),
}))
vi.mock("@/components/shared/MediaFolderToolbar", () => ({
  MediaFolderToolbar: () => <div data-testid="media-folder-toolbar" />,
}))

vi.mock("@/stores/sidebarStore", () => ({
  useSidebarStore: vi.fn(),
  compareByDisplayName: (a: string, b: string) => a.localeCompare(b),
}))

vi.mock("@/stores/uiMediaFolderStore", () => ({
  useUIMediaFolderStoreState: vi.fn(),
  useUIMediaFolderStoreActions: vi.fn(),
  useUIMediaFolderSelection: vi.fn(),
}))

vi.mock("@/hooks/mediaMetadata/useMediaMetadataQuery", () => ({
  useMediaMetadataQuery: vi.fn(),
}))

vi.mock("@/providers/dialog-provider", () => ({
  useDialogs: vi.fn(() => ({
    renameFileDialog: [vi.fn(), vi.fn()],
    renameFolderDialog: [vi.fn(), vi.fn()],
  })),
}))

vi.mock("@/hooks/userConfig", () => ({
  useConfig: vi.fn(() => ({
    userConfig: { folders: [] },
    setAndSaveUserConfig: vi.fn(),
  })),
}))

vi.mock("@/api/openInFileManager", () => ({
  openInFileManagerApi: vi.fn(),
}))

vi.mock("@/lib/utils", () => ({
  nextTraceId: vi.fn(() => "trace-id"),
}))

vi.mock("@/api/metadata", () => ({
  deleteMetadata: vi.fn(),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock("../sidebar/MediaFolderListItemV2", () => ({
  MediaFolderListItemV2: ({
    path,
    mediaName,
    onDelete,
  }: {
    path: string
    mediaName: string
    onDelete?: () => void
  }) => (
    <div>
      <h5 data-testid="sidebar-folder-title">{mediaName}</h5>
      <button type="button" data-testid={`delete-${path}`} onClick={onDelete}>
        delete-{path}
      </button>
    </div>
  ),
}))

import { useQueries } from "@tanstack/react-query"
import { useSidebarStore } from "@/stores/sidebarStore"
import {
  useUIMediaFolderStoreState,
  useUIMediaFolderStoreActions,
  useUIMediaFolderSelection,
} from "@/stores/uiMediaFolderStore"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata/useMediaMetadataQuery"
import { useUnimportFolderMutation, useFoldersQuery } from "@/hooks/folders"

const mockUseQueries = useQueries as ReturnType<typeof vi.fn>
const mockUseSidebarStore = useSidebarStore as ReturnType<typeof vi.fn>
const mockUseUIMediaFolderStoreState = useUIMediaFolderStoreState as ReturnType<typeof vi.fn>
const mockUseUIMediaFolderStoreActions = useUIMediaFolderStoreActions as ReturnType<typeof vi.fn>
const mockUseUIMediaFolderSelection = useUIMediaFolderSelection as ReturnType<typeof vi.fn>
const mockUseMediaMetadataQuery = useMediaMetadataQuery as ReturnType<typeof vi.fn>

function baseSidebarMocks() {
  mockUseSidebarStore.mockReturnValue({
    sortOrder: "asc",
    filterType: "all",
    searchQuery: "",
    setSortOrder: vi.fn(),
    setFilterType: vi.fn(),
    setSearchQuery: vi.fn(),
  })
  mockUseUIMediaFolderStoreActions.mockReturnValue({
    applyFolderClick: vi.fn(),
    selectAllFolderPaths: vi.fn(),
    removeFolder: vi.fn(),
  })
}

describe("Sidebar delete behavior", () => {
  const pathA = "/media/folder-a"
  const pathB = "/media/folder-b"

  beforeEach(() => {
    vi.clearAllMocks()
    baseSidebarMocks()
    mockUseUIMediaFolderStoreState.mockReturnValue({
      folders: [
        { path: pathA, status: "ok", test: false },
        { path: pathB, status: "ok", test: false },
      ],
      selectedFolder: pathA,
      selectedFolders: [pathA, pathB],
    })
    mockUseUIMediaFolderSelection.mockReturnValue({
      selectedFolder: pathA,
      selectedFolders: [pathA, pathB],
      selectedFolderPathsSet: new Set([pathA, pathB]),
    })
    mockUseMediaMetadataQuery.mockReturnValue({ data: { mediaFolderPath: pathA } })
    mockUseQueries.mockReturnValue([{ data: null }, { data: null }])
    vi.mocked(useFoldersQuery).mockReturnValue({
      data: [pathA, pathB],
      isFetching: false,
    } as ReturnType<typeof useFoldersQuery>)
    vi.mocked(useUnimportFolderMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    } as ReturnType<typeof useUnimportFolderMutation>)
  })

  it("deletes full selected set when deleting a selected item", () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useUnimportFolderMutation).mockReturnValue({
      mutateAsync,
    } as ReturnType<typeof useUnimportFolderMutation>)
    const onDeleteSelected = vi.fn()
    render(<Sidebar onDeleteSelected={onDeleteSelected} />)

    fireEvent.click(screen.getByTestId(`delete-${Path.toPlatformPath(pathA)}`))

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync).toHaveBeenCalledWith(expect.arrayContaining([pathA, pathB]))
    expect(onDeleteSelected).not.toHaveBeenCalled()
  })

  it("deletes single item when clicked item is not in selected set", () => {
    mockUseUIMediaFolderSelection.mockReturnValue({
      selectedFolder: pathA,
      selectedFolders: [pathA],
      selectedFolderPathsSet: new Set([pathA]),
    })
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useUnimportFolderMutation).mockReturnValue({
      mutateAsync,
    } as ReturnType<typeof useUnimportFolderMutation>)
    const onDeleteSelected = vi.fn()
    render(<Sidebar onDeleteSelected={onDeleteSelected} />)

    fireEvent.click(screen.getByTestId(`delete-${Path.toPlatformPath(pathB)}`))

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync).toHaveBeenCalledWith([Path.toPlatformPath(pathB)])
    expect(onDeleteSelected).not.toHaveBeenCalled()
  })
})

describe("Sidebar i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    baseSidebarMocks()
    vi.mocked(useFoldersQuery).mockReturnValue({
      data: [],
      isFetching: false,
    } as ReturnType<typeof useFoldersQuery>)
    mockUseUIMediaFolderStoreState.mockReturnValue({
      folders: [],
      selectedFolder: null,
      selectedFolders: [],
    })
    mockUseUIMediaFolderSelection.mockReturnValue({
      selectedFolder: null,
      selectedFolders: [],
      selectedFolderPathsSet: new Set(),
    })
    mockUseMediaMetadataQuery.mockReturnValue({ data: undefined })
    mockUseQueries.mockReturnValue([])
  })

  it("passes the translated placeholder to the search form", () => {
    render(<Sidebar />)
    expect(screen.getByTestId("search-form")).toHaveTextContent("sidebar.searchPlaceholder")
  })

  it("renders the translated empty state when no folders match", () => {
    render(<Sidebar />)
    expect(screen.getByTestId("sidebar-empty-state")).toHaveTextContent("sidebar.emptyState")
  })
})

describe("Sidebar mediaName", () => {
  const folderPath = "/media/library/RawFolder"

  beforeEach(() => {
    vi.clearAllMocks()
    baseSidebarMocks()
    vi.mocked(useFoldersQuery).mockReturnValue({
      data: [folderPath],
      isFetching: false,
    } as ReturnType<typeof useFoldersQuery>)
    mockUseUIMediaFolderStoreState.mockReturnValue({
      folders: [{ path: folderPath, status: "ok", test: false }],
      selectedFolder: folderPath,
      selectedFolders: [folderPath],
    })
    mockUseUIMediaFolderSelection.mockReturnValue({
      selectedFolder: folderPath,
      selectedFolders: [folderPath],
      selectedFolderPathsSet: new Set([folderPath]),
    })
    mockUseMediaMetadataQuery.mockReturnValue({ data: { mediaFolderPath: folderPath } })
  })

  it("passes tv show title as mediaName when tvShow is set", () => {
    const showTitle = "Recognized TV Title"
    mockUseQueries.mockReturnValue([
      {
        data: {
          type: "tvshow-folder",
          tvShow: {
            database: "TMDB",
            id: "1",
            name: showTitle,
            seasons: [],
          },
        } as MediaMetadata,
      },
    ])

    render(<Sidebar />)

    expect(screen.getByTestId("sidebar-folder-title")).toHaveTextContent(showTitle)
  })

  it("passes movie title as mediaName when movie is set", () => {
    const movieTitle = "Recognized Movie Title"
    mockUseQueries.mockReturnValue([
      {
        data: {
          type: "movie-folder",
          movie: {
            database: "TMDB",
            id: "2",
            name: movieTitle,
          },
        } as MediaMetadata,
      },
    ])

    render(<Sidebar />)

    expect(screen.getByTestId("sidebar-folder-title")).toHaveTextContent(movieTitle)
  })

  it("passes folder basename as mediaName when query has no metadata", () => {
    mockUseQueries.mockReturnValue([{ data: undefined }])

    render(<Sidebar />)

    expect(screen.getByTestId("sidebar-folder-title")).toHaveTextContent(basename(folderPath))
  })

  it("passes basename of mediaFolderPath when metadata has no tvShow or movie", () => {
    const aliasPath = "/media/other/AliasFolderName"
    mockUseQueries.mockReturnValue([
      {
        data: {
          type: "movie-folder",
          mediaFolderPath: aliasPath,
        } as MediaMetadata,
      },
    ])

    render(<Sidebar />)

    expect(screen.getByTestId("sidebar-folder-title")).toHaveTextContent(basename(aliasPath))
  })
})
