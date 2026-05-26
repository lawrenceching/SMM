/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MusicFileTable, type LocalFileTableRowData } from "./MusicFileTable";
import {
  createMockLocalFileSubtitleContext,
  type LocalFileSubtitleContextValue,
} from "./LocalFileSubtitleScope";

const mockUseLocalFileSubtitle = vi.fn<() => LocalFileSubtitleContextValue>();

vi.mock("./LocalFileSubtitleScope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./LocalFileSubtitleScope")>();
  return {
    ...actual,
    LocalFileSubtitleScope: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useLocalFileSubtitle: () => mockUseLocalFileSubtitle(),
  };
});

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  castTranslationFn: (fn: any) => fn,
}));

vi.mock("@/hooks/useGetAssociatedFiles", () => ({
  useGetAssociatedFiles: () => [],
}));

vi.mock("@/stores/backgroundJobsStore", () => ({
  useBackgroundJobsStore: (selector: (state: any) => any) => {
    const store = { jobs: [] }
    return selector(store)
  },
}));

vi.mock("@/hooks/userConfig/useConfig", () => ({
  useConfig: () => ({
    appConfig: { version: "1.0.0", userDataDir: "/data", reverseProxyUrl: null },
    userConfig: {
      selectedAIProvider: undefined,
      aiProviders: undefined,
    },
    setUserConfig: () => {},
    isLoading: false,
    isUserConfigLoaded: false,
    error: null,
    setAndSaveUserConfig: () => Promise.resolve(),
    reload: () => {},
    refreshUserConfig: () => Promise.resolve(),
    addMediaFolderInUserConfig: () => Promise.resolve(),
  }),
}));

vi.mock("@/components/ui/context-menu", () => {
  const React = require("react");
  return {
    ContextMenu: ({ children }: any) => <div>{children}</div>,
    ContextMenuTrigger: ({ children }: any) => <div>{children}</div>,
    ContextMenuContent: ({ children }: any) => <div>{children}</div>,
    ContextMenuSub: ({ children }: any) => <div data-testid="context-menu-sub">{children}</div>,
    ContextMenuSubTrigger: ({ children, disabled }: any) => (
      <button type="button" disabled={disabled}>
        {children}
      </button>
    ),
    ContextMenuSubContent: ({ children }: any) => <div>{children}</div>,
    ContextMenuItem: ({ children, disabled, onClick }: any) => (
      <button disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
  };
});

vi.mock("@/components/ui/hover-card", () => {
  const React = require("react");
  return {
    HoverCard: ({ children }: any) => <div>{children}</div>,
    HoverCardTrigger: ({ children }: any) => <div>{children}</div>,
    HoverCardContent: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock("@/components/Image", () => ({
  default: () => <div />,
}));

const row: LocalFileTableRowData = {
  kind: "local",
  id: 1,
  index: 0,
  title: "Song A",
  artist: "Artist A",
  duration: 120,
  path: "/tmp/song-a.mp3",
};

beforeEach(() => {
  mockUseLocalFileSubtitle.mockReturnValue(createMockLocalFileSubtitleContext());
});

/** Context-menu Transcribe invokes subtitle context row actions. */
describe("MusicFileTable transcribe action", () => {
  it("disables transcribe action when capability unavailable", () => {
    mockUseLocalFileSubtitle.mockReturnValue(
      createMockLocalFileSubtitleContext({
        getRowSubtitleUi: () => ({
          indexColumnVariant: "index",
          titleTooltip: row.title,
          submenuDisabled: false,
          transcribeStartDisabled: true,
          translateStartDisabled: true,
          synthesizeStartDisabled: true,
          processStartDisabled: true,
          canTranslate: false,
          canSynthesize: false,
          canProcess: false,
        }),
      }),
    );
    render(<MusicFileTable data={[row]} />);
    const btn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.transcribe/i });
    expect(btn).toBeDisabled();
  });

  it("does not trigger callback when transcribe action is disabled", () => {
    const onTranscribe = vi.fn();
    mockUseLocalFileSubtitle.mockReturnValue(
      createMockLocalFileSubtitleContext({
        getRowSubtitleUi: () => ({
          indexColumnVariant: "index",
          titleTooltip: row.title,
          submenuDisabled: false,
          transcribeStartDisabled: true,
          translateStartDisabled: true,
          synthesizeStartDisabled: true,
          processStartDisabled: true,
          canTranslate: false,
          canSynthesize: false,
          canProcess: false,
        }),
        bindRowActions: () => ({
          onTranscribe,
          onTranscribeStop: vi.fn(),
          onTranslate: vi.fn(),
          onTranslateStop: vi.fn(),
          onSynthesize: vi.fn(),
          onSynthesizeStop: vi.fn(),
          onProcess: vi.fn(),
          onProcessStop: vi.fn(),
        }),
      }),
    );
    render(<MusicFileTable data={[row]} />);
    const btn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.transcribe/i });
    fireEvent.click(btn);
    expect(onTranscribe).not.toHaveBeenCalled();
  });

  it("triggers callback when transcribe is enabled", () => {
    const onTranscribe = vi.fn();
    mockUseLocalFileSubtitle.mockReturnValue(
      createMockLocalFileSubtitleContext({
        bindRowActions: () => ({
          onTranscribe,
          onTranscribeStop: vi.fn(),
          onTranslate: vi.fn(),
          onTranslateStop: vi.fn(),
          onSynthesize: vi.fn(),
          onSynthesizeStop: vi.fn(),
          onProcess: vi.fn(),
          onProcessStop: vi.fn(),
        }),
      }),
    );
    render(<MusicFileTable data={[row]} />);
    const btn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.transcribe/i });
    fireEvent.click(btn);
    expect(onTranscribe).toHaveBeenCalled();
  });
});

const row2: LocalFileTableRowData = {
  kind: "local",
  id: 2,
  index: 1,
  title: "Song B",
  artist: "Artist B",
  duration: 90,
  path: "/tmp/song-b.mp3",
};

describe("MusicFileTable multi-select mode", () => {
  it("shows select-all checkbox in index header when multi-select mode is on", () => {
    const { rerender } = render(
      <MusicFileTable data={[row]} isMultiSelectMode={false} />,
    );

    expect(screen.getByText("musicFileTable.columns.index")).toBeInTheDocument();
    expect(screen.queryByTestId("music-file-table-select-all")).not.toBeInTheDocument();

    rerender(<MusicFileTable data={[row]} isMultiSelectMode={true} />);

    expect(screen.queryByText("musicFileTable.columns.index")).not.toBeInTheDocument();
    expect(screen.getByTestId("music-file-table-select-all")).toBeInTheDocument();
  });

  it("selects all rows when header checkbox is checked", () => {
    const onSelectedTrackIdsChange = vi.fn();
    render(
      <MusicFileTable
        data={[row, row2]}
        isMultiSelectMode={true}
        selectedTrackIds={[]}
        onSelectedTrackIdsChange={onSelectedTrackIdsChange}
      />,
    );

    fireEvent.click(screen.getByTestId("music-file-table-select-all"));
    expect(onSelectedTrackIdsChange).toHaveBeenCalledWith([1, 2]);
  });

  it("clears selection when header checkbox is unchecked", () => {
    const onSelectedTrackIdsChange = vi.fn();
    render(
      <MusicFileTable
        data={[row, row2]}
        isMultiSelectMode={true}
        selectedTrackIds={[1, 2]}
        onSelectedTrackIdsChange={onSelectedTrackIdsChange}
      />,
    );

    fireEvent.click(screen.getByTestId("music-file-table-select-all"));
    expect(onSelectedTrackIdsChange).toHaveBeenCalledWith([]);
  });

  it("shows checkbox in index column for every row in multi-select mode", () => {
    const { rerender } = render(
      <MusicFileTable
        data={[row]}
        isMultiSelectMode={false}
        selectedTrackIds={[]}
      />
    );

    expect(screen.queryByTestId("music-file-row-checkbox-1")).not.toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    rerender(
      <MusicFileTable
        data={[row]}
        isMultiSelectMode={true}
        selectedTrackIds={[]}
      />
    );

    const checkbox = screen.getByTestId(
      "music-file-row-checkbox-1",
    ) as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("calls selected ids change callback when checkbox is toggled", () => {
    const onSelectedTrackIdsChange = vi.fn();
    render(
      <MusicFileTable
        data={[row]}
        isMultiSelectMode={true}
        selectedTrackIds={[1]}
        onSelectedTrackIdsChange={onSelectedTrackIdsChange}
      />
    );

    fireEvent.click(screen.getByTestId("music-file-row-checkbox-1"));
    expect(onSelectedTrackIdsChange).toHaveBeenCalledWith([]);
  });

  it("toggles row selection when clicking the row in multi-select mode", () => {
    const onSelectedTrackIdsChange = vi.fn();
    const { rerender } = render(
      <MusicFileTable
        data={[row]}
        isMultiSelectMode={true}
        selectedTrackIds={[]}
        onSelectedTrackIdsChange={onSelectedTrackIdsChange}
      />
    );

    fireEvent.click(screen.getByText("Song A"));
    expect(onSelectedTrackIdsChange).toHaveBeenCalledWith([1]);

    rerender(
      <MusicFileTable
        data={[row]}
        isMultiSelectMode={true}
        selectedTrackIds={[1]}
        onSelectedTrackIdsChange={onSelectedTrackIdsChange}
      />
    );

    fireEvent.click(screen.getByText("Song A"));
    expect(onSelectedTrackIdsChange).toHaveBeenLastCalledWith([]);
  });
});

const videoRow: LocalFileTableRowData = {
  ...row,
  path: "/tmp/track.mp4",
};

describe("MusicFileTable synthesize action", () => {
  it("disables synthesize when capability or eligibility is false", () => {
    mockUseLocalFileSubtitle.mockReturnValue(
      createMockLocalFileSubtitleContext({
        getRowSubtitleUi: () => ({
          indexColumnVariant: "index",
          titleTooltip: videoRow.title,
          submenuDisabled: false,
          transcribeStartDisabled: true,
          translateStartDisabled: true,
          synthesizeStartDisabled: true,
          processStartDisabled: true,
          canTranslate: false,
          canSynthesize: false,
          canProcess: false,
        }),
      }),
    );
    render(<MusicFileTable data={[videoRow]} />);
    const btn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.synthesize/i });
    expect(btn).toBeDisabled();
  });

  it("invokes onSynthesize when enabled", () => {
    const onSynthesize = vi.fn();
    mockUseLocalFileSubtitle.mockReturnValue(
      createMockLocalFileSubtitleContext({
        bindRowActions: () => ({
          onTranscribe: vi.fn(),
          onTranscribeStop: vi.fn(),
          onTranslate: vi.fn(),
          onTranslateStop: vi.fn(),
          onSynthesize,
          onSynthesizeStop: vi.fn(),
          onProcess: vi.fn(),
          onProcessStop: vi.fn(),
        }),
      }),
    );
    render(<MusicFileTable data={[videoRow]} />);
    fireEvent.click(screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.synthesize/i }));
    expect(onSynthesize).toHaveBeenCalled();
  });

  it("shows stop synthesize while running", () => {
    const onSynthesizeStop = vi.fn();
    mockUseLocalFileSubtitle.mockReturnValue(
      createMockLocalFileSubtitleContext({
        getRowSubtitleUi: () => ({
          indexColumnVariant: "spinner",
          titleTooltip: videoRow.title,
          submenuDisabled: false,
          transcribeStartDisabled: true,
          translateStartDisabled: true,
          synthesizeStartDisabled: true,
          processStartDisabled: true,
          synthesizeStatus: "running",
          canTranslate: false,
          canSynthesize: true,
          canProcess: false,
        }),
        bindRowActions: () => ({
          onTranscribe: vi.fn(),
          onTranscribeStop: vi.fn(),
          onTranslate: vi.fn(),
          onTranslateStop: vi.fn(),
          onSynthesize: vi.fn(),
          onSynthesizeStop,
          onProcess: vi.fn(),
          onProcessStop: vi.fn(),
        }),
      }),
    );
    render(<MusicFileTable data={[videoRow]} />);
    const stopBtn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.synthesizeStop/i });
    expect(stopBtn).not.toBeDisabled();
    fireEvent.click(stopBtn);
    expect(onSynthesizeStop).toHaveBeenCalled();
  });
});

describe("MusicFileTable process action", () => {
  it("disables process when capability unavailable", () => {
    mockUseLocalFileSubtitle.mockReturnValue(
      createMockLocalFileSubtitleContext({
        getRowSubtitleUi: () => ({
          indexColumnVariant: "index",
          titleTooltip: videoRow.title,
          submenuDisabled: false,
          transcribeStartDisabled: true,
          translateStartDisabled: true,
          synthesizeStartDisabled: true,
          processStartDisabled: true,
          canTranslate: false,
          canSynthesize: false,
          canProcess: false,
        }),
      }),
    );
    render(<MusicFileTable data={[videoRow]} />);
    const btn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.process/i });
    expect(btn).toBeDisabled();
  });

  it("invokes onProcess when enabled", () => {
    const onProcess = vi.fn();
    mockUseLocalFileSubtitle.mockReturnValue(
      createMockLocalFileSubtitleContext({
        bindRowActions: () => ({
          onTranscribe: vi.fn(),
          onTranscribeStop: vi.fn(),
          onTranslate: vi.fn(),
          onTranslateStop: vi.fn(),
          onSynthesize: vi.fn(),
          onSynthesizeStop: vi.fn(),
          onProcess,
          onProcessStop: vi.fn(),
        }),
      }),
    );
    render(<MusicFileTable data={[videoRow]} />);
    fireEvent.click(screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.process/i }));
    expect(onProcess).toHaveBeenCalled();
  });

  it("shows stop process while running", () => {
    const onProcessStop = vi.fn();
    mockUseLocalFileSubtitle.mockReturnValue(
      createMockLocalFileSubtitleContext({
        getRowSubtitleUi: () => ({
          indexColumnVariant: "spinner",
          titleTooltip: videoRow.title,
          submenuDisabled: false,
          transcribeStartDisabled: true,
          translateStartDisabled: true,
          synthesizeStartDisabled: true,
          processStartDisabled: true,
          processStatus: "running",
          canTranslate: false,
          canSynthesize: false,
          canProcess: true,
        }),
        bindRowActions: () => ({
          onTranscribe: vi.fn(),
          onTranscribeStop: vi.fn(),
          onTranslate: vi.fn(),
          onTranslateStop: vi.fn(),
          onSynthesize: vi.fn(),
          onSynthesizeStop: vi.fn(),
          onProcess: vi.fn(),
          onProcessStop,
        }),
      }),
    );
    render(<MusicFileTable data={[videoRow]} />);
    const stopBtn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.processStop/i });
    expect(stopBtn).not.toBeDisabled();
    fireEvent.click(stopBtn);
    expect(onProcessStop).toHaveBeenCalled();
  });
});
