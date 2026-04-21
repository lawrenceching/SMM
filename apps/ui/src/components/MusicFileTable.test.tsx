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
