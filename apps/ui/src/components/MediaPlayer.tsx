import { useState, useEffect, useCallback, useRef } from 'react';
import { MediaPlayerToolbar, type SortBy } from './MediaPlayerToolbar';
import { MediaPlayerTrackList } from './MediaPlayerTrackList';
import { MediaPlayerControlBar } from './MediaPlayerControlBar';

export interface Track {
  id: number;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  addedDate: Date;
  path?: string;
  isDownloading?: boolean;
}

export type MediaPlayerMode = 'view' | 'player';

export interface MediaPlayerProps {
  tracks?: Track[];
  className?: string;
  mode?: MediaPlayerMode;
  onDownloadClick?: () => void;
}

const DEFAULT_TRACKS: Track[] = [
  { id: 1, title: "Midnight Dreams", artist: "Luna Nova", duration: 234, thumbnail: "https://picsum.photos/seed/music1/200", addedDate: new Date('2024-01-15'), path: undefined },
  { id: 2, title: "Electric Pulse", artist: "Neon Waves", duration: 198, thumbnail: "https://picsum.photos/seed/music2/200", addedDate: new Date('2024-02-01'), path: undefined },
  { id: 3, title: "Sunset Boulevard", artist: "The Wanderers", duration: 267, thumbnail: "https://picsum.photos/seed/music3/200", addedDate: new Date('2024-01-20'), path: undefined },
  { id: 4, title: "Crystal Clear", artist: "Aurora Skies", duration: 312, thumbnail: "https://picsum.photos/seed/music4/200", addedDate: new Date('2024-02-10'), path: undefined },
  { id: 5, title: "Jazz Cafe", artist: "Blue Notes", duration: 285, thumbnail: "https://picsum.photos/seed/music5/200", addedDate: new Date('2024-01-05'), path: undefined },
  { id: 6, title: "Mountain High", artist: "Echo Valley", duration: 246, thumbnail: "https://picsum.photos/seed/music6/200", addedDate: new Date('2024-02-15'), path: undefined },
  { id: 7, title: "City Lights", artist: "Urban Beat", duration: 203, thumbnail: "https://picsum.photos/seed/music7/200", addedDate: new Date('2024-01-25'), path: undefined },
  { id: 8, title: "Ocean Waves", artist: "Coastal Drift", duration: 278, thumbnail: "https://picsum.photos/seed/music8/200", addedDate: new Date('2024-02-05'), path: undefined },
  { id: 9, title: "Moonlight Sonata", artist: "Classical Ensemble", duration: 356, thumbnail: "https://picsum.photos/seed/music9/200", addedDate: new Date('2024-01-10'), path: undefined },
  { id: 10, title: "Summer Nights", artist: "Tropical Vibes", duration: 221, thumbnail: "https://picsum.photos/seed/music10/200", addedDate: new Date('2024-02-20'), path: undefined },
  { id: 11, title: "Rainy Day", artist: "Mellow Tones", duration: 298, thumbnail: "https://picsum.photos/seed/music11/200", addedDate: new Date('2024-01-30'), path: undefined },
  { id: 12, title: "Symphony No. 5", artist: "Orchestra Phil", duration: 412, thumbnail: "https://picsum.photos/seed/music12/200", addedDate: new Date('2024-02-12'), path: undefined },
];

export function MediaPlayer({ tracks = DEFAULT_TRACKS, className = '', mode = 'view', onDownloadClick }: MediaPlayerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const progressIntervalRef = useRef<number | null>(null);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getFilteredAndSortedTracks = useCallback((): Track[] => {
    let filtered = [...tracks];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query)
      );
    }

    switch (sortBy) {
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'artist':
        filtered.sort((a, b) => a.artist.localeCompare(b.artist));
        break;
      case 'duration':
        filtered.sort((a, b) => a.duration - b.duration);
        break;
      case 'recent':
        filtered.sort((a, b) => b.addedDate.getTime() - a.addedDate.getTime());
        break;
    }

    return filtered;
  }, [tracks, searchQuery, sortBy]);

  const filteredTracks = getFilteredAndSortedTracks();

  const playTrack = useCallback(async (track: Track) => {
    setIsLoading(true);
    
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
      setIsLoading(false);
      return;
    }

    setCurrentTrack(track);
    setProgress(0);
    setIsPlaying(true);
    setIsLoading(false);
  }, [currentTrack, isPlaying]);

  const togglePlay = useCallback(() => {
    if (!currentTrack && filteredTracks.length > 0) {
      playTrack(filteredTracks[0]);
      return;
    }
    setIsPlaying(prev => !prev);
  }, [currentTrack, filteredTracks, playTrack]);

  const playNext = useCallback(() => {
    if (!currentTrack || filteredTracks.length === 0) return;

    const currentIndex = filteredTracks.findIndex(t => t.id === currentTrack.id);
    let nextIndex;

    if (shuffle) {
      nextIndex = Math.floor(Math.random() * filteredTracks.length);
    } else {
      nextIndex = (currentIndex + 1) % filteredTracks.length;
    }

    playTrack(filteredTracks[nextIndex]);
  }, [currentTrack, filteredTracks, shuffle, playTrack]);

  const playPrevious = useCallback(() => {
    if (!currentTrack || filteredTracks.length === 0) return;

    const currentProgressSeconds = (progress / 100) * (currentTrack.duration || 0);

    if (currentProgressSeconds > 5) {
      setProgress(0);
      return;
    }

    const currentIndex = filteredTracks.findIndex(t => t.id === currentTrack.id);
    let prevIndex;

    if (shuffle) {
      prevIndex = Math.floor(Math.random() * filteredTracks.length);
    } else {
      prevIndex = (currentIndex - 1 + filteredTracks.length) % filteredTracks.length;
    }

    playTrack(filteredTracks[prevIndex]);
  }, [currentTrack, filteredTracks, shuffle, progress, playTrack]);

  const handleProgressChange = useCallback((value: number) => {
    setProgress(value);
  }, []);

  const handleVolumeChange = useCallback((value: number) => {
    setVolume(value);
    setIsMuted(value === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (mode === 'view') return;
    if (e.target instanceof HTMLInputElement) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight':
        if (e.ctrlKey) {
          e.preventDefault();
          playNext();
        }
        break;
      case 'ArrowLeft':
        if (e.ctrlKey) {
          e.preventDefault();
          playPrevious();
        }
        break;
      case 'm':
        e.preventDefault();
        toggleMute();
        break;
    }
  }, [mode, togglePlay, playNext, playPrevious, toggleMute]);

  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (isPlaying && currentTrack) {
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => {
          const increment = 100 / currentTrack.duration;
          const newProgress = Math.min(100, prev + increment);

          if (newProgress >= 100) {
            if (repeat) {
              return 0;
            } else {
              playNext();
              return 0;
            }
          }

          return newProgress;
        });
      }, 1000);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, currentTrack, repeat, playNext]);

  useEffect(() => {
    if (mode === 'view') return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (e.ctrlKey) {
            e.preventDefault();
            playNext();
          }
          break;
        case 'ArrowLeft':
          if (e.ctrlKey) {
            e.preventDefault();
            playPrevious();
          }
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, togglePlay, playNext, playPrevious, toggleMute]);

  return (
    <div 
      className={`flex flex-col h-full bg-background text-foreground ${className}`}
      onKeyDown={handleKeyDown}
      role="application"
      aria-label="Music Player"
    >
      <MediaPlayerToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSortChange={setSortBy}
        sortValue={sortBy}
        onDownloadClick={onDownloadClick}
      />

      <main className="flex-1 overflow-y-auto px-6 py-4">
        <MediaPlayerTrackList
          filteredTracks={filteredTracks}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          mode={mode}
          onTrackClick={playTrack}
          formatTime={formatTime}
        />
      </main>

      {mode === 'player' && (
        <MediaPlayerControlBar
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          isLoading={isLoading}
          progress={progress}
          volume={volume}
          isMuted={isMuted}
          shuffle={shuffle}
          repeat={repeat}
          onTogglePlay={togglePlay}
          onPlayNext={playNext}
          onPlayPrevious={playPrevious}
          onProgressChange={handleProgressChange}
          onVolumeChange={handleVolumeChange}
          onToggleMute={toggleMute}
          onToggleShuffle={() => setShuffle(!shuffle)}
          onToggleRepeat={() => setRepeat(!repeat)}
          formatTime={formatTime}
        />
      )}
    </div>
  );
}
