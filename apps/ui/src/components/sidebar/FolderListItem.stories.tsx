import type { Meta, StoryObj } from "@storybook/react-vite"
import { FolderListItem } from "./FolderListItem"

const meta = {
  title: "Components/Sidebar/FolderListItem",
  component: FolderListItem,
  decorators: [
    (Story) => (
      <div className="w-[280px] rounded-md border border-border bg-sidebar overflow-hidden">
        <Story />
      </div>
    ),
  ],
  args: {
    mediaName: "Breaking Bad",
    mediaType: "tvshow",
    path: "/media/tvshows/Breaking Bad",
    status: "ok",
    isSelected: false,
    isPrimary: false,
  },
} satisfies Meta<typeof FolderListItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Selected: Story = {
  args: {
    isSelected: true,
  },
}

export const PrimarySelected: Story = {
  args: {
    isSelected: true,
    isPrimary: true,
  },
}

export const Movie: Story = {
  args: {
    mediaName: "Inception",
    mediaType: "movie",
    path: "/media/movies/Inception (2010)",
  },
}

export const Music: Story = {
  args: {
    mediaName: "Dark Side of the Moon",
    mediaType: "music",
    path: "/media/music/Pink Floyd - Dark Side of the Moon",
  },
}

export const Loading: Story = {
  args: {
    status: "loading",
  },
}

export const PendingForInitialization: Story = {
  args: {
    status: "pending_for_initialization",
  },
}

export const FolderNotFound: Story = {
  args: {
    mediaName: "Missing Show",
    path: "/media/tvshows/Missing Show",
    status: "folder_not_found",
  },
}
