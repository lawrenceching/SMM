import { useState, type ComponentProps } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { action } from "storybook/actions"
import {
  MediaFileTableToolbar,
  type EpisodeTableLayout,
  type MediaFileTableMenuId,
} from "./MediaFileTableToolbar"

function SearchLeading({ value }: { value: string }) {
  return (
    <input
      className="h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-lg font-semibold"
      defaultValue={value}
      readOnly
    />
  )
}

const sharedCallbacks = {
  onRecognizeButtonClick: action("recognize"),
  onRenameButtonClick: action("rename"),
  onScrapeButtonClick: action("scrape"),
  onTranscribeClick: action("transcribe"),
  onTranslateClick: action("translate"),
  onSynthesizeClick: action("synthesize"),
  onProcessClick: action("process"),
}

function InteractiveToolbar(
  props: Omit<ComponentProps<typeof MediaFileTableToolbar>, "layout" | "onLayoutChange" | "leading"> & {
    title: string
  },
) {
  const [layout, setLayout] = useState<EpisodeTableLayout>("simple")
  return (
    <MediaFileTableToolbar
      leading={<SearchLeading value={props.title} />}
      layout={layout}
      onLayoutChange={setLayout}
      loading={props.loading}
      showPreviewLayoutButton={props.showPreviewLayoutButton}
      hiddenMenuIds={props.hiddenMenuIds}
      disabledMenuIds={props.disabledMenuIds}
      externalUrl={props.externalUrl}
      testIdPrefix={props.testIdPrefix}
      {...sharedCallbacks}
    />
  )
}

const meta = {
  title: "Components/MediaFileTableToolbar",
  component: MediaFileTableToolbar,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MediaFileTableToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const TvShow: Story = {
  args: {
    leading: <SearchLeading value="Breaking Bad" />,
    externalUrl: "https://www.themoviedb.org/tv/1396",
    testIdPrefix: "tvshow-header",
  },
  render: () => (
    <InteractiveToolbar
      title="Breaking Bad"
      externalUrl="https://www.themoviedb.org/tv/1396"
      testIdPrefix="tvshow-header"
    />
  ),
}

export const Movie: Story = {
  args: {
    leading: <SearchLeading value="Inception" />,
    hiddenMenuIds: ["recognize"] satisfies MediaFileTableMenuId[],
    externalUrl: "https://www.themoviedb.org/movie/27205",
    testIdPrefix: "movie-header",
  },
  render: () => (
    <InteractiveToolbar
      title="Inception"
      hiddenMenuIds={["recognize"]}
      externalUrl="https://www.themoviedb.org/movie/27205"
      testIdPrefix="movie-header"
    />
  ),
}

export const Loading: Story = {
  args: {
    leading: <SearchLeading value="Loading" />,
    loading: true,
  },
}

export const HarmonyOS: Story = {
  args: {
    leading: <SearchLeading value="Breaking Bad" />,
    showPreviewLayoutButton: false,
    hiddenMenuIds: ["subtitle", "transcribe", "translate", "synthesize", "process"],
    externalUrl: "https://www.themoviedb.org/tv/1396",
  },
  render: () => (
    <InteractiveToolbar
      title="Breaking Bad"
      showPreviewLayoutButton={false}
      hiddenMenuIds={["subtitle", "transcribe", "translate", "synthesize", "process"]}
      externalUrl="https://www.themoviedb.org/tv/1396"
    />
  ),
}

export const Unrecognized: Story = {
  args: {
    leading: <SearchLeading value="" />,
    disabledMenuIds: [
      "recognize",
      "rename",
      "scrape",
      "subtitle",
      "transcribe",
      "translate",
      "synthesize",
      "process",
    ],
  },
  render: () => (
    <InteractiveToolbar
      title=""
      disabledMenuIds={[
        "recognize",
        "rename",
        "scrape",
        "subtitle",
        "transcribe",
        "translate",
        "synthesize",
        "process",
      ]}
    />
  ),
}
