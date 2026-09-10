import type { Meta, StoryObj } from "@storybook/react-vite"
import { action } from "storybook/actions"
import {
  MediaFileTableEpisodeSimpleRow,
  type MediaFileTableEpisodeSimpleRowProps,
} from "./MediaFileTableRow"

// ------------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------------

const seasonFolder = "/media/shows/Breaking Bad/Season 1"

const currentPath = `${seasonFolder}/S01E01.mkv`
const renameTargetPath = `${seasonFolder}/Breaking Bad - S01E01 - Pilot.mkv`
const recognizedTargetPath = `${seasonFolder}/Breaking.Bad.S01E01.720p.mkv`
const thumbnailPath = `${seasonFolder}/S01E01-thumb.jpg`
const subtitlePath = `${seasonFolder}/S01E01.en.srt`
const nfoPath = `${seasonFolder}/S01E01.nfo`

/**
 * Renders a single simple episode row inside a table whose colgroup mirrors
 * the row's fixed cell layout, so the story matches how the row appears in
 * the real table.
 */
function SimpleRowTable(props: MediaFileTableEpisodeSimpleRowProps) {
  // The checkbox column only renders while `onCheck` is provided.
  const hasCheckbox = props.onCheck !== undefined
  return (
    <div className="w-full max-w-[820px] overflow-hidden rounded-md border bg-card">
      <table className="w-full table-fixed text-xs">
        <colgroup>
          {hasCheckbox && <col className="w-10" />}
          <col className="w-[100px]" />
          <col />
          <col className="w-10" />
          <col className="w-10" />
          <col className="w-10" />
        </colgroup>
        <tbody>
          <MediaFileTableEpisodeSimpleRow {...props} />
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------------------
// Meta
// ------------------------------------------------------------------------

const meta = {
  title: "Components/MediaFileTableEpisodeSimpleRow",
  component: SimpleRowTable,
  args: {
    season: 1,
    episode: 1,
    title: "Pilot",
  },
} satisfies Meta<typeof SimpleRowTable>

export default meta
type Story = StoryObj<typeof meta>

// ------------------------------------------------------------------------
// Scenarios
// ------------------------------------------------------------------------

/** Plain row with a linked file and all associated files present. */
export const Default: Story = {
  args: {
    path: currentPath,
    thumbnailPath,
    subtitlePath,
    nfoPath,
  },
}

/** Row participating in a preview plan: checkbox column + checked state. */
export const Checked: Story = {
  args: {
    path: currentPath,
    thumbnailPath,
    subtitlePath,
    nfoPath,
    isChecked: true,
    onCheck: action("onCheck"),
  },
}

/** Row that does not participate in the current plan: muted + disabled box. */
export const Disabled: Story = {
  args: {
    path: currentPath,
    thumbnailPath,
    subtitlePath,
    isDisabled: true,
    onCheck: action("onCheck"),
  },
}

/** Rename preview: current path struck through, rename target below. */
export const PreviewRename: Story = {
  args: {
    path: currentPath,
    newFilePath: renameTargetPath,
    thumbnailPath,
    subtitlePath,
    nfoPath,
    isChecked: true,
    onCheck: action("onCheck"),
  },
}

/** Recognize preview: currently linked path struck through, recognized file below. */
export const PreviewRecognition: Story = {
  args: {
    path: currentPath,
    newRecognizedFilePath: recognizedTargetPath,
    thumbnailPath,
    subtitlePath,
    isChecked: true,
    onCheck: action("onCheck"),
  },
}
