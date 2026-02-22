import { useMediaMetadata } from "@/providers/media-metadata-provider";
import { MediaPlayer } from "./MediaPlayer";
import { useMemo } from "react";
import { newMusicMediaMetadata, convertMusicFilesToTracks } from "@/lib/music";

export function MusicPanel() {

  const { selectedMediaMetadata } = useMediaMetadata();

  const tracks = useMemo(() => {
    if(!selectedMediaMetadata) {
      return undefined;
    }
    const musicMediaMetadata = newMusicMediaMetadata(selectedMediaMetadata);
    return convertMusicFilesToTracks(musicMediaMetadata.musicFiles);
  }, [selectedMediaMetadata])

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <MediaPlayer tracks={tracks} />
    </div>
  );
}