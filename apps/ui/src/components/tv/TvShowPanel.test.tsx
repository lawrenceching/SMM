import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, waitFor } from "@testing-library/react"
import type { MediaMetadata } from "@smm/types"
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan"

const FOLDER = "/storage/show"
const EP1_PATH = `${FOLDER}/S01E01.mkv`
const EP2_PATH = `${FOLDER}/S01E02.mkv`

// Regression shape from the 2026-09-05 bug: the plan proposes S01E01 + S01E02,
// but metadata only links S01E01. S01E02's table path is undefined, so the
// confirm payload must come from the PLAN, not from metadata.
const makePlan = (): RecognizeMediaFilePlan => ({
  id: "plan-1",
  task: "recognize-media-file",
  status: "pending",
  creator: "app",
  mediaFolderPath: FOLDER,
  files: [
    { season: 1, episode: 1, path: EP1_PATH },
    { season: 1, episode: 2, path: EP2_PATH },
  ],
})

const makeMetadata = (): MediaMetadata =>
  ({
    mediaFolderPath: FOLDER,
    type: "tvshow-folder",
    tvShow: {
      id: "1",
      name: "Show",
      seasons: [
        {
          season: 1,
          name: "Season 1",
          episodes: [
            { season: 1, episode: 1, name: "E1" },
            { season: 1, episode: 2, name: "E2" },
          ],
        },
      ],
    },
    mediaFiles: [{ absolutePath: EP1_PATH, seasonNumber: 1, episodeNumber: 1 }],
  }) as unknown as MediaMetadata

const h = vi.hoisted(() => ({
  metadata: undefined as unknown,
  recognizePlan: undefined as unknown,
  recognizeConfirm: vi.fn(),
  recognizeCancel: vi.fn(),
  recognizeStart: vi.fn(),
  renameConfirm: vi.fn(),
}))

vi.mock("@/stores/uiMediaFolderStore", () => ({
  useUIMediaFolderStoreState: () => ({ folders: [], selectedFolder: "/storage/show" }),
  useUIMediaFolderStore: { getState: () => ({ applyFolderClick: vi.fn() }) },
}))

vi.mock("@/hooks/mediaMetadata", () => ({
  useMediaMetadataQuery: () => ({
    data: h.metadata,
    isError: false,
    isPending: false,
    fetchStatus: "idle",
  }),
}))

vi.mock("@/hooks/useMediaFolderFilesQuery", () => ({
  useMediaFolderFilesQuery: () => ({ data: [] }),
}))

vi.mock("@/hooks/plans", () => ({
  usePlansQuery: () => ({ data: [] }),
}))

vi.mock("@/hooks/useSelectTvShowForFolderMutation", () => ({
  useSelectTvShowForFolderMutation: () => ({
    selectTvShowForFolderMutation: { mutate: vi.fn() },
    updateMediaMetadata: vi.fn(),
  }),
}))

vi.mock("@/hooks/mediaMetadata/useFetchMediaMetadataMutation", () => ({
  useFetchMediaMetadataMutation: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock("@/hooks/useResolvedLanguages", () => ({
  useResolvedLanguages: () => ({ mediaLanguage: "en-US" }),
}))

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: () => ({ isVideoCompressionEnabled: false, isFormatConverterEnabled: false }),
}))

vi.mock("@/hooks/tv/useTvShowEpisodeVideoCompress", () => ({
  useTvShowEpisodeVideoCompress: () => ({ handleVideoCompressForRow: vi.fn() }),
}))

vi.mock("@/hooks/tv/useTvShowEpisodeFormatConvert", () => ({
  useTvShowEpisodeFormatConvert: () => ({ handleFormatConvertForRow: vi.fn() }),
}))

vi.mock("@/hooks/useSubtitleFlow", () => ({
  useSubtitleFlow: () => ({
    showSubtitleMenu: false,
    dialogs: { transcribe: {}, translate: {}, synthesize: {}, pipeline: {} },
    header: {},
  }),
}))

vi.mock("@/hooks/useRenameVideoFileFlow", () => ({
  useRenameVideoFileFlow: () => ({ onRenameContextMenuClick: vi.fn() }),
}))

vi.mock("@/hooks/tv/useSelectAndUnselectFileFlow", () => ({
  useSelectAndUnselectFileFlow: () => ({
    onSelectFileContextMenuClick: vi.fn(),
    onUnlinkContextMenuClick: vi.fn(),
  }),
}))

vi.mock("@/hooks/tv/useTvShowPanelState", () => ({
  useTvShowPanelState: () => undefined,
}))

vi.mock("@/lib/dialogRequestEvents", () => ({
  askForRenameFile: vi.fn(),
  askForScrape: vi.fn(),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

vi.mock("@/hooks/tv/useRuleBasedRecognizeFlow", () => ({
  useRuleBasedRecognizeFlow: () => ({
    plan: h.recognizePlan,
    open: h.recognizePlan !== undefined,
    loading: false,
    tvShowTitle: "Show",
    tvShowTmdbId: 1,
    notAllEpisodesRecognized: false,
    allPlanFilesUnchanged: false,
    confirm: h.recognizeConfirm,
    cancel: h.recognizeCancel,
    start: h.recognizeStart,
  }),
}))

vi.mock("@/hooks/tv/useRuleBasedRenameFilesFlow", () => ({
  useRuleBasedRenameFilesFlow: () => ({
    plan: undefined,
    open: false,
    loading: false,
    selectedNamingRule: "plex",
    namingRuleOptions: [
      { value: "plex", label: "Plex" },
      { value: "emby", label: "Emby" },
    ],
    selectNamingRule: vi.fn(),
    confirm: h.renameConfirm,
    cancel: vi.fn(),
    start: vi.fn(),
  }),
}))

vi.mock("@/hooks/tv/useAiBasedRenameEpisodeFlow", () => ({
  useAiBasedRenameEpisodeFlow: () => ({
    plan: undefined,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    promptProps: { isOpen: false, onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
}))

vi.mock("@/hooks/tv/useAiBasedRecognizeEpisodeFlow", () => ({
  useAiBasedRecognizeEpisodeFlow: () => ({
    plan: undefined,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    promptProps: { isOpen: false, onConfirm: vi.fn(), onCancel: vi.fn() },
  }),
}))

vi.mock("./TvShowPanelHeader", () => ({ TvShowPanelHeader: () => null }))
vi.mock("./TvShowPanelPrompts", () => ({ TvShowPanelPrompts: () => null }))
vi.mock("../RuleBasedRenameFilePrompt", () => ({
  RuleBasedRenameFilePrompt: () => null,
}))

vi.mock("@/components/dialogs", () => ({
  TranscribeDialog: () => null,
  SubtitleTranslationDialog: () => null,
  SynthesizeSubtitleDialog: () => null,
  ProcessPipelineDialog: () => null,
}))

// Checkbox stub: MediaFileTable is a heavy table component; the panel contract
// under test is the (season, episode) toggle -> onCheck -> confirm payload flow.
vi.mock("@/components/media/MediaFileTable", async () => {
  const { createElement } = await import("react")
  return {
    MediaFileTable: (props: {
      seasonData: { season: number; episodes: { season: number; episode: number }[] }[]
      selectedEpisodes?: { season: number; episode: number }[]
      onCheck?: (season: number, episode: number, checked: boolean) => void
    }) =>
      createElement(
        "div",
        { "data-testid": "media-file-table" },
        props.seasonData
          .flatMap((s) => s.episodes)
          .map((e) => {
            const checked =
              props.selectedEpisodes?.some(
                (sel) => sel.season === e.season && sel.episode === e.episode,
              ) ?? false
            return createElement(
              "button",
              {
                key: `${e.season}-${e.episode}`,
                "data-testid": `episode-check-${e.season}-${e.episode}`,
                "data-checked": checked ? "true" : "false",
                onClick: () => props.onCheck?.(e.season, e.episode, !checked),
              },
              `S${e.season}E${e.episode}-${checked ? "checked" : "unchecked"}`,
            )
          }),
      ),
  }
})

import TvShowPanel from "./TvShowPanel"

const getEpisodeButton = (container: HTMLElement, season: number, episode: number) =>
  container.querySelector(`[data-testid="episode-check-${season}-${episode}"]`) as HTMLElement

describe("TvShowPanel rule-based recognize confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.metadata = makeMetadata()
    h.recognizePlan = makePlan()
  })

  it("seeds both plan episodes as checked and passes all plan paths to recognizeFlow.confirm", async () => {
    const { container, getByTestId } = render(<TvShowPanel />)

    await waitFor(() => {
      expect(getEpisodeButton(container, 1, 1)).toHaveAttribute("data-checked", "true")
      expect(getEpisodeButton(container, 1, 2)).toHaveAttribute("data-checked", "true")
    })

    fireEvent.click(getByTestId("floating-prompt-confirm-button"))

    expect(h.recognizeConfirm).toHaveBeenCalledTimes(1)
    // Regression: S01E02 is not linked in metadata; it must still be applied
    // via the plan path (the old table-based lookup dropped it).
    expect(h.recognizeConfirm).toHaveBeenCalledWith([EP1_PATH, EP2_PATH])
  })

  it("excludes an unchecked episode from the confirm payload", async () => {
    const { container, getByTestId } = render(<TvShowPanel />)

    await waitFor(() => {
      expect(getEpisodeButton(container, 1, 2)).toHaveAttribute("data-checked", "true")
    })

    fireEvent.click(getEpisodeButton(container, 1, 2))
    await waitFor(() => {
      expect(getEpisodeButton(container, 1, 2)).toHaveAttribute("data-checked", "false")
    })

    fireEvent.click(getByTestId("floating-prompt-confirm-button"))

    expect(h.recognizeConfirm).toHaveBeenCalledTimes(1)
    expect(h.recognizeConfirm).toHaveBeenCalledWith([EP1_PATH])
  })

  it("passes an empty array when every episode is unchecked", async () => {
    const { container, getByTestId } = render(<TvShowPanel />)

    await waitFor(() => {
      expect(getEpisodeButton(container, 1, 1)).toHaveAttribute("data-checked", "true")
    })

    fireEvent.click(getEpisodeButton(container, 1, 1))
    fireEvent.click(getEpisodeButton(container, 1, 2))

    fireEvent.click(getByTestId("floating-prompt-confirm-button"))

    expect(h.recognizeConfirm).toHaveBeenCalledTimes(1)
    expect(h.recognizeConfirm).toHaveBeenCalledWith([])
  })

  it("does not call confirm when the recognize prompt is not open", () => {
    h.recognizePlan = undefined
    const { queryByTestId } = render(<TvShowPanel />)

    expect(queryByTestId("floating-prompt-confirm-button")).toBeNull()
    expect(h.recognizeConfirm).not.toHaveBeenCalled()
  })
})
