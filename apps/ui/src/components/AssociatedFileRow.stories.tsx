import type { Meta, StoryObj } from "@storybook/react-vite"
import { AssociatedFileRow } from "./AssociatedFileRow"
import type { AssociatedFile } from "@/types/associated-files"

const meta = {
  title: "Components/AssociatedFileRow",
  component: AssociatedFileRow,
  decorators: [
    (Story) => (
      <div className="w-[720px] rounded-md border bg-card p-4">
        <div
          role="table"
          style={{
            display: "grid",
            gridTemplateColumns: "40px 64px 1fr 128px 64px 32px",
          }}
          className="w-full text-xs"
        >
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof AssociatedFileRow>

export default meta
type Story = StoryObj<typeof meta>

export const Subtitle: Story = {
  args: {
    file: {
      type: "subtitle",
      path: "/media/library/Example Track.srt",
    } satisfies AssociatedFile,
  },
}

export const LanguageSubtitled: Story = {
  args: {
    file: {
      type: "subtitle",
      path: "/media/library/Example Track.en-US.ass",
    } satisfies AssociatedFile,
  },
}

export const Audio: Story = {
  args: {
    file: {
      type: "audio",
      path: "/media/library/Example Track.mka",
    } satisfies AssociatedFile,
  },
}

export const Thumbnail: Story = {
  args: {
    file: {
      type: "thumbnail",
      path: "/media/library/Example Track.jpg",
    } satisfies AssociatedFile,
  },
}

export const Summary: Story = {
  args: {
    file: {
      type: "summary",
      path: "/media/library/Example Track.nfo",
    } satisfies AssociatedFile,
  },
}
