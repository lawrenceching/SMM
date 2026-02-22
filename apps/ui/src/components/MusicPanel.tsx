import { useMediaMetadata } from "@/providers/media-metadata-provider";
import { MediaPlayer } from "./MediaPlayer";
import { useMemo } from "react";
import { newMusicMediaMetadata } from "@/lib/music";

export function MusicPanel() {

  const { selectedMediaMetadata } = useMediaMetadata();

  const musicMediaMetadata = useMemo(() => {

    if(!selectedMediaMetadata) {
      return undefined;
    }
    return newMusicMediaMetadata(selectedMediaMetadata)

  }, [selectedMediaMetadata])

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <MediaPlayer mediaMetadata={musicMediaMetadata} />
    </div>
  );
}