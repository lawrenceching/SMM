import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn, mocked } from "storybook/test"
import { basename } from "@/lib/path"
import { folderMatchesSearchQuery } from "@/lib/sidebarFolderSearch"
import { useSidebar } from "@/hooks/useSidebar"
import { FolderListItem } from "./FolderListItem"
import type { FolderListItemContainerProps } from "./FolderListItemContainer"
import { Sidebar } from "./Sidebar"

const demoFolders = [
  {
    path: "/media/tvshows/Breaking Bad",
    mediaName: "Breaking Bad",
    mediaType: "tvshow" as const,
    status: "ok" as const,
  },
  {
    path: "/media/movies/Inception (2010)",
    mediaName: "Inception",
    mediaType: "movie" as const,
    status: "loading" as const,
  },
  {
    path: "/media/tvshows/Pending Show",
    mediaName: "Pending Show",
    mediaType: "tvshow" as const,
    status: "pending_for_initialization" as const,
  },
  {
    path: "/media/tvshows/Missing Show",
    mediaName: "Missing Show",
    mediaType: "tvshow" as const,
    status: "folder_not_found" as const,
  },
]

const demoByPath = Object.fromEntries(demoFolders.map((f) => [f.path, f]))

/** Pure presentational row for Storybook — selection/click come from Sidebar. */
function StoryFolderListItem(props: FolderListItemContainerProps) {
  const demo = demoByPath[props.path]
  return (
    <FolderListItem
      mediaName={demo?.mediaName ?? basename(props.path) ?? props.path}
      mediaType={demo?.mediaType ?? "movie"}
      status={demo?.status ?? "ok"}
      {...props}
    />
  )
}

const meta = {
  title: "Components/Sidebar/Sidebar",
  component: Sidebar,
  decorators: [
    (Story) => (
      <div className="h-[480px] w-[280px] rounded-md border border-border overflow-hidden">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    mocked(useSidebar).mockImplementation((options = {}) => ({
      sortOrder: "alphabetical",
      filterType: "all",
      setSortOrder: fn(),
      setFilterType: fn(),
      filteredAndSortedFolders: demoFolders
        .filter((f) => folderMatchesSearchQuery(f, options.searchQuery ?? ""))
        .map((f) => f.path),
      handleRename: fn(),
      handleOpenInExplorer: fn(),
      handleDeletePaths: fn(),
    }))
  },
  args: {
    folderListItemSlot: StoryFolderListItem,
  },
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Uncontrolled selection + search in Sidebar, pure {@link FolderListItem} rows.
 * Click to select; Ctrl/Cmd+click to multi-select; type in the search box to filter.
 */
export const WithPureFolderListItems: Story = {}
