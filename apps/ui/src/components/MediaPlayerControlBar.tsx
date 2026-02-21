import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Volume2, 
  VolumeX, 
  Music
} from 'lucide-react';
import type { Track } from './MediaPlayer';

export interface MediaPlayerControlBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: boolean;
  onTogglePlay: () => void;
  onPlayNext: () => void;
  onPlayPrevious: () => void;
  onProgressChange: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  formatTime: (seconds: number) => string;
}

export function MediaPlayerControlBar({
  currentTrack,
  isPlaying,
  isLoading,
  progress,
  volume,
  isMuted,
  shuffle,
  repeat,
  onTogglePlay,
  onPlayNext,
  onPlayPrevious,
  onProgressChange,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  formatTime
}: MediaPlayerControlBarProps) {
  const currentProgressTime = currentTrack ? (progress / 100) * currentTrack.duration : 0;
  const displayVolume = isMuted ? 0 : volume;

  return (
    <footer className="flex-shrink-0 bg-card border-t border-border px-6 py-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 w-72">
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
            {currentTrack ? (
              <img 
                src={currentTrack.thumbnail} 
                alt={`${currentTrack.album} cover`} 
                className="w-full h-full object-cover"
              />
            ) : (
              <Music className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {currentTrack?.title || 'Select a track'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentTrack?.artist || '--'}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <button
              onClick={onToggleShuffle}
              className={`p-2 transition-colors duration-200 ${
                shuffle ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button
              onClick={onPlayPrevious}
              className="p-2 text-foreground hover:text-green-500 transition-colors duration-200"
              aria-label="Previous track"
            >
              <SkipBack className="w-6 h-6" />
            </button>
            <button
              onClick={onTogglePlay}
              disabled={isLoading}
              className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-500/90 transition-all duration-200 shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>
            <button
              onClick={onPlayNext}
              className="p-2 text-foreground hover:text-green-500 transition-colors duration-200"
              aria-label="Next track"
            >
              <SkipForward className="w-6 h-6" />
            </button>
            <button
              onClick={onToggleRepeat}
              className={`p-2 transition-colors duration-200 ${
                repeat ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Repeat"
            >
              <Repeat className="w-5 h-5" />
            </button>
          </div>

          <div className="w-full max-w-xl flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(currentProgressTime)}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => onProgressChange(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-green-500 hover:accent-green-400 transition-colors"
              aria-label="Track progress"
            />
            <span className="text-xs text-muted-foreground w-10">
              {currentTrack ? formatTime(currentTrack.duration) : '0:00'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-48">
          <button
            onClick={onToggleMute}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || displayVolume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={displayVolume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-green-500 hover:accent-green-400 transition-colors"
            aria-label="Volume"
          />
        </div>
      </div>
    </footer>
  );
}
