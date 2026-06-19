/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { LocalFileRow } from "./LocalFileRow"
import type { LocalFileTableRowData } from "./MusicFileTable"
import {
  LocalFileSubtitleMockProvider,
  createMockLocalFileSubtitleContext,
} from "./LocalFileSubtitleScope"
import type { UseFeaturesResult } from "@/hooks/useFeatures"
import type {
  LocalFileTableRowFileMenu,
  LocalFileTableRowSubtitleActions,
  MusicTableSelection,
} from "@/types/music-table"
import type { RowSubtitleUi } from "@/hooks/useMusicFolderSubtitlePipeline"

const mockUseFeatures = vi.fn<() => UseFeaturesResult>()

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: () => mockUseFeatures(),
}))

vi.mock("@/lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n")>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
    castTranslationFn: (fn: unknown) => fn,
  }
})
vi.mock("@/components/ui/context-menu", () => {
  const React = require("react")
  return {
    ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ContextMenuSub: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="context-menu-sub">{children}</div>
    ),
    ContextMenuSubTrigger: ({
      children,
      disabled,
    }: {
      children: React.ReactNode
      disabled?: boolean
    }) => (
      <button type="button" disabled={disabled}>
        {children}
      </button>
    ),
    ContextMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ContextMenuItem: ({
      children,
      disabled,
      onClick,
    }: {
      children: React.ReactNode
      disabled?: boolean
      onClick?: () => void
    }) => (
      <button disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
  }
})

 vi.mock("./SubtitleContextMenuItems", () => ({
   SubtitleContextMenuItems: () => null,
 }))

vi.mock("./musicTableRowShared", () => ({
  MusicRowMediaCells: () => <div data-testid="media-cells" />,
}))

const row: LocalFileTableRowData = {
  kind: "local",
  id: 1,
  index: 0,
  title: "Song A",
  artist: "Artist A",
  duration: 120,
  path: "/tmp/song-a.mp3",
}

const baseFileMenu: LocalFileTableRowFileMenu = {
  onOpen: vi.fn(),
  onDelete: vi.fn(),
  onProperties: vi.fn(),
  onFormatConvert: vi.fn(),
  onVideoCompress: vi.fn(),
  onSummarize: vi.fn(),
  canSummarize: true,
}

const baseSubtitleActions: LocalFileTableRowSubtitleActions = {
  onTranscribe: vi.fn(),
  onTranscribeStop: vi.fn(),
  onTranslate: vi.fn(),
  onTranslateStop: vi.fn(),
  onSynthesize: vi.fn(),
  onSynthesizeStop: vi.fn(),
  onProcess: vi.fn(),
  onProcessStop: vi.fn(),
}

const baseSubtitleUi: RowSubtitleUi = createMockLocalFileSubtitleContext().getRowSubtitleUi(
  row,
  false,
  false,
)

const baseSelection: MusicTableSelection = {
  isMultiSelectMode: false,
  selectedTrackIds: [],
}

function defaultFeatures(overrides: Partial<UseFeaturesResult> = {}): UseFeaturesResult {
  return {
    isAiFeatureEnabled: true,
    setIsAiFeatureEnabled: vi.fn(),
    isAiAreaEnabled: false,
    setIsAiAreaEnabled: vi.fn(),
    isTranscribeEnabled: true,
    isSubtitleFeaturesEnabled: true,
    isDownloadVideoEnabled: true,
    isFormatConverterEnabled: true,
    isVideoCompressionEnabled: true,
    isVideoCaptionerAsrOptionsEnabled: true,
    setVideoCaptionerAsrOptionsEnabled: vi.fn(),
    isTencentAsrTranscribeEnabled: false,
    setTencentAsrTranscribeEnabled: vi.fn(),
    isMobileLayoutEnabled: false,
    setMobileLayoutEnabled: vi.fn(),
    enableTtyForYtdlpCommand: false,
    setEnableTtyForYtdlpCommand: vi.fn(),
    enablePrintArgInYtdlpCommand: false,
    setEnablePrintArgInYtdlpCommand: vi.fn(),
    isDisplayFeatureCardsInWelcomeEnabled: true,
    setIsDisplayFeatureCardsInWelcomeEnabled: vi.fn(),
    isUIAiChatTransportEnabled: false,
    setIsUIAiChatTransportEnabled: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  mockUseFeatures.mockReset()
  mockUseFeatures.mockReturnValue(defaultFeatures())
})

interface RowHarnessProps {
  fileMenu: LocalFileTableRowFileMenu
  onSummarize?: () => void
  canSummarize?: boolean
}

function RowHarness({ fileMenu, onSummarize, canSummarize = true }: RowHarnessProps) {
  return (
    <LocalFileSubtitleMockProvider>
      <LocalFileRow
        row={row}
        mediaFolderPath="/music"
        isSelected={false}
        isExpanded={false}
        selection={baseSelection}
        subtitleUi={baseSubtitleUi}
        subtitleActions={baseSubtitleActions}
        fileMenu={fileMenu}
        onTrackClick={() => {}}
        onToggleExpand={() => {}}
        onSummarize={onSummarize}
        canSummarize={canSummarize}
      />
    </LocalFileSubtitleMockProvider>
  )
}

describe("LocalFileRow Summarize context-menu item gating", () => {
  it("renders the Summarize item when isAiFeatureEnabled is true", () => {
    mockUseFeatures.mockReturnValue(defaultFeatures({ isAiFeatureEnabled: true }))
    render(<RowHarness fileMenu={baseFileMenu} onSummarize={() => {}} />)
    expect(
      screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.summarize/i }),
    ).toBeInTheDocument()
  })

  it("hides the Summarize item when isAiFeatureEnabled is false (HarmonyOS default)", () => {
    mockUseFeatures.mockReturnValue(defaultFeatures({ isAiFeatureEnabled: false }))
    render(<RowHarness fileMenu={baseFileMenu} onSummarize={() => {}} />)
    expect(
      screen.queryByRole("button", { name: /mediaPlayer.trackContextMenu.summarize/i }),
    ).not.toBeInTheDocument()
  })

  it("does not invoke the summarize callback when the item is hidden", () => {
    mockUseFeatures.mockReturnValue(defaultFeatures({ isAiFeatureEnabled: false }))
    const onSummarize = vi.fn()
    render(<RowHarness fileMenu={baseFileMenu} onSummarize={onSummarize} />)
    expect(onSummarize).not.toHaveBeenCalled()
  })
})
