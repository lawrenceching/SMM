import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MusicHeaderV2 } from "./MusicHeaderV2";

vi.mock("@/components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: any) => (
      <div data-testid="music-header-dropdown-root">{children}</div>
    ),
    DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div role="menu">{children}</div>,
    DropdownMenuItem: ({ children, disabled, onClick, ...rest }: any) => (
      <button type="button" disabled={disabled} onClick={onClick} {...rest}>
        {children}
      </button>
    ),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string; ns?: string }) => {
      if (_key === "mediaPlayer.select") return "Select";
      if (_key === "cancel" && opts?.ns === "common") return "Cancel";
      return opts?.defaultValue ?? _key;
    },
  }),
}));

describe("MusicHeaderV2 multi-select toggle", () => {
  const selectedMediaMetadata = {
    mediaFolderPath: "/media/music",
    files: ["/media/music/song1.mp3"],
  } as any;

  it("renders Select when mode is inactive and triggers callback", () => {
    const onToggleMultiSelectMode = vi.fn();
    render(
      <MusicHeaderV2
        selectedMediaMetadata={selectedMediaMetadata}
        isMultiSelectMode={false}
        onToggleMultiSelectMode={onToggleMultiSelectMode}
      />,
    );

    const button = screen.getByTestId("music-multi-select-toggle");
    expect(button).toHaveTextContent("Select");
    fireEvent.click(button);
    expect(onToggleMultiSelectMode).toHaveBeenCalledTimes(1);
  });

  it("renders Cancel when mode is active", () => {
    render(
      <MusicHeaderV2
        selectedMediaMetadata={selectedMediaMetadata}
        isMultiSelectMode={true}
      />,
    );

    expect(screen.getByTestId("music-multi-select-toggle")).toHaveTextContent("Cancel");
  });

  it("enables header Transcribe when targets exist without multi-select mode", () => {
    const onTranscribeClick = vi.fn();
    render(
      <MusicHeaderV2
        selectedMediaMetadata={selectedMediaMetadata}
        onTranscribeClick={onTranscribeClick}
        isTranscribeAvailable={true}
        hasTranscribeTargets={true}
        isMultiSelectMode={false}
      />,
    );

    const transcribe = screen.getByTestId("music-multi-select-transcribe");
    expect(transcribe).not.toBeDisabled();
    fireEvent.click(transcribe);
    expect(onTranscribeClick).toHaveBeenCalledTimes(1);
  });

  it("disables subtitle menu when transcribe, translate, and synthesize are all unavailable", () => {
    render(
      <MusicHeaderV2
        selectedMediaMetadata={
          { mediaFolderPath: "/media/music", files: [] } as any
        }
        isTranscribeAvailable={false}
        hasTranscribeTargets={false}
        isTranslateAvailable={false}
        hasTranslateTargets={false}
        isSynthesizeAvailable={false}
        hasSynthesizeTargets={false}
      />,
    );
    expect(screen.getByTestId("music-header-subtitle")).toBeDisabled();
  });

  it("calls onSynthesizeClick when synthesize is the only available subtitle action", () => {
    const onSynthesizeClick = vi.fn();
    render(
      <MusicHeaderV2
        selectedMediaMetadata={
          { mediaFolderPath: "/media/music", files: [] } as any
        }
        isTranscribeAvailable={false}
        hasTranscribeTargets={false}
        isTranslateAvailable={false}
        hasTranslateTargets={false}
        isSynthesizeAvailable
        hasSynthesizeTargets
        onSynthesizeClick={onSynthesizeClick}
      />,
    );
    expect(screen.getByTestId("music-header-subtitle")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("music-header-synthesize"));
    expect(onSynthesizeClick).toHaveBeenCalledTimes(1);
  });

  it("calls onProcessClick when process is the only available subtitle action", () => {
    const onProcessClick = vi.fn();
    render(
      <MusicHeaderV2
        selectedMediaMetadata={
          { mediaFolderPath: "/media/music", files: [] } as any
        }
        isTranscribeAvailable={false}
        hasTranscribeTargets={false}
        isTranslateAvailable={false}
        hasTranslateTargets={false}
        isSynthesizeAvailable={false}
        hasSynthesizeTargets={false}
        isProcessAvailable
        hasProcessTargets
        onProcessClick={onProcessClick}
      />,
    );
    expect(screen.getByTestId("music-header-subtitle")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("music-header-process"));
    expect(onProcessClick).toHaveBeenCalledTimes(1);
  });
});
