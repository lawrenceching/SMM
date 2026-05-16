/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MusicFileTable, type MusicFileRow } from "./MusicFileTable";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

const row: MusicFileRow = {
  id: 1,
  index: 0,
  title: "Song A",
  artist: "Artist A",
  duration: 120,
  path: "/tmp/song-a.mp3",
};

/** Context-menu Transcribe invokes parent; parent opens TranscribeDialog. */
describe("MusicFileTable transcribe action", () => {
  it("disables transcribe action when capability unavailable", () => {
    render(
      <MusicFileTable
        data={[row]}
        isTranscribeAvailable={false}
      />
    );
    const btn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.transcribe/i });
    expect(btn).toBeDisabled();
  });

  it("does not trigger callback when transcribe action is disabled", () => {
    const onTrackTranscribe = vi.fn();
    render(
      <MusicFileTable
        data={[row]}
        isTranscribeAvailable={false}
        onTrackTranscribe={onTrackTranscribe}
      />
    );
    const btn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.transcribe/i });
    fireEvent.click(btn);
    expect(onTrackTranscribe).not.toHaveBeenCalled();
  });

  it("triggers callback when transcribe is enabled", () => {
    const onTrackTranscribe = vi.fn();
    render(
      <MusicFileTable
        data={[row]}
        isTranscribeAvailable={true}
        onTrackTranscribe={onTrackTranscribe}
      />
    );
    const btn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.transcribe/i });
    fireEvent.click(btn);
    expect(onTrackTranscribe).toHaveBeenCalledWith(row);
  });
});

const row2: MusicFileRow = {
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

const videoRow: MusicFileRow = {
  ...row,
  path: "/tmp/track.mp4",
};

describe("MusicFileTable synthesize action", () => {
  it("disables synthesize when capability or canSynthesize is false", () => {
    render(
      <MusicFileTable
        data={[{ ...videoRow, canSynthesize: true }]}
        isSynthesizeAvailable={false}
      />,
    );
    const btn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.synthesize/i });
    expect(btn).toBeDisabled();
  });

  it("invokes onTrackSynthesize when enabled", () => {
    const onTrackSynthesize = vi.fn();
    render(
      <MusicFileTable
        data={[{ ...videoRow, canSynthesize: true }]}
        isSynthesizeAvailable
        canSynthesize
        onTrackSynthesize={onTrackSynthesize}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.synthesize/i }));
    expect(onTrackSynthesize).toHaveBeenCalledWith(expect.objectContaining({ path: videoRow.path }));
  });

  it("shows stop synthesize while running", () => {
    const onSynthesizeStop = vi.fn();
    render(
      <MusicFileTable
        data={[{ ...videoRow, canSynthesize: true, synthesizeStatus: "running" }]}
        isSynthesizeAvailable
        onSynthesizeStop={onSynthesizeStop}
      />,
    );
    const stopBtn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.synthesizeStop/i });
    expect(stopBtn).not.toBeDisabled();
    fireEvent.click(stopBtn);
    expect(onSynthesizeStop).toHaveBeenCalled();
  });
});

describe("MusicFileTable process action", () => {
  it("disables process when capability unavailable", () => {
    render(
      <MusicFileTable
        data={[videoRow]}
        isProcessAvailable={false}
      />,
    );
    const btn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.process/i });
    expect(btn).toBeDisabled();
  });

  it("invokes onTrackProcess when enabled", () => {
    const onTrackProcess = vi.fn();
    render(
      <MusicFileTable
        data={[videoRow]}
        isProcessAvailable
        onTrackProcess={onTrackProcess}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.process/i }));
    expect(onTrackProcess).toHaveBeenCalledWith(expect.objectContaining({ path: videoRow.path }));
  });

  it("shows stop process while running", () => {
    const onProcessStop = vi.fn();
    render(
      <MusicFileTable
        data={[{ ...videoRow, processStatus: "running" }]}
        isProcessAvailable
        onProcessStop={onProcessStop}
      />,
    );
    const stopBtn = screen.getByRole("button", { name: /mediaPlayer.trackContextMenu.processStop/i });
    expect(stopBtn).not.toBeDisabled();
    fireEvent.click(stopBtn);
    expect(onProcessStop).toHaveBeenCalled();
  });
});
