import { MediaPlayer } from "./MediaPlayer";

export function MusicPanel() {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <MediaPlayer />
    </div>
  );
}