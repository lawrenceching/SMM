import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Volume2, 
  VolumeX, 
  Search,
  Filter,
  SortAsc,
  MoreVertical,
  Music
} from 'lucide-react';

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre: string;
  thumbnail: string;
  addedDate: Date;
}

export interface MediaPlayerProps {
  tracks?: Track[];
  className?: string;
}

const DEFAULT_TRACKS: Track[] = [
  { id: 1, title: "Midnight Dreams", artist: "Luna Nova", album: "Starlight", duration: 234, genre: "electronic", thumbnail: "https://picsum.photos/seed/music1/200", addedDate: new Date('2024-01-15') },
  { id: 2, title: "Electric Pulse", artist: "Neon Waves", album: "Digital Age", duration: 198, genre: "electronic", thumbnail: "https://picsum.photos/seed/music2/200", addedDate: new Date('2024-02-01') },
  { id: 3, title: "Sunset Boulevard", artist: "The Wanderers", album: "Road Trip", duration: 267, genre: "rock", thumbnail: "https://picsum.photos/seed/music3/200", addedDate: new Date('2024-01-20') },
  { id: 4, title: "Crystal Clear", artist: "Aurora Skies", album: "Reflections", duration: 312, genre: "pop", thumbnail: "https://picsum.photos/seed/music4/200", addedDate: new Date('2024-02-10') },
  { id: 5, title: "Jazz Cafe", artist: "Blue Notes", album: "Midnight Sessions", duration: 285, genre: "jazz", thumbnail: "https://picsum.photos/seed/music5/200", addedDate: new Date('2024-01-05') },
  { id: 6, title: "Mountain High", artist: "Echo Valley", album: "Nature's Call", duration: 246, genre: "rock", thumbnail: "https://picsum.photos/seed/music6/200", addedDate: new Date('2024-02-15') },
  { id: 7, title: "City Lights", artist: "Urban Beat", album: "Metropolis", duration: 203, genre: "pop", thumbnail: "https://picsum.photos/seed/music7/200", addedDate: new Date('2024-01-25') },
  { id: 8, title: "Ocean Waves", artist: "Coastal Drift", album: "Sea Breeze", duration: 278, genre: "electronic", thumbnail: "https://picsum.photos/seed/music8/200", addedDate: new Date('2024-02-05') },
  { id: 9, title: "Moonlight Sonata", artist: "Classical Ensemble", album: "Timeless", duration: 356, genre: "classical", thumbnail: "https://picsum.photos/seed/music9/200", addedDate: new Date('2024-01-10') },
  { id: 10, title: "Summer Nights", artist: "Tropical Vibes", album: "Paradise", duration: 221, genre: "pop", thumbnail: "https://picsum.photos/seed/music10/200", addedDate: new Date('2024-02-20') },
  { id: 11, title: "Rainy Day", artist: "Mellow Tones", album: "Comfort Zone", duration: 298, genre: "jazz", thumbnail: "https://picsum.photos/seed/music11/200", addedDate: new Date('2024-01-30') },
  { id: 12, title: "Symphony No. 5", artist: "Orchestra Phil", album: "Classics", duration: 412, genre: "classical", thumbnail: "https://picsum.photos/seed/music12/200", addedDate: new Date('2024-02-12') },
];

const GENRES = ['all', 'pop', 'rock', 'electronic', 'jazz', 'classical'] as const;
const SORT_OPTIONS = [
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
  { value: 'artist', label: 'Artist (A-Z)' },
  { value: 'duration', label: 'Duration' },
  { value: 'recent', label: 'Recently Added' }
] as const;

type Genre = typeof GENRES[number];
type SortBy = typeof SORT_OPTIONS[number]['value'];

export function MediaPlayer({ tracks = DEFAULT_TRACKS, className = '' }: MediaPlayerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState<Genre>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
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
        track.artist.toLowerCase().includes(query) ||
        track.album.toLowerCase().includes(query)
      );
    }

    if (filterGenre !== 'all') {
      filtered = filtered.filter(track => track.genre === filterGenre);
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
  }, [tracks, searchQuery, filterGenre, sortBy]);

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
  }, [togglePlay, playNext, playPrevious, toggleMute]);

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
  }, [togglePlay, playNext, playPrevious, toggleMute]);

  const currentProgressTime = currentTrack ? (progress / 100) * currentTrack.duration : 0;
  const displayVolume = isMuted ? 0 : volume;

  return (
    <div 
      className={`flex flex-col h-full bg-background text-foreground ${className}`}
      onKeyDown={handleKeyDown}
      role="application"
      aria-label="Music Player"
    >
      <header className="flex-shrink-0 bg-card/80 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-primary flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">MusicBox</h1>
          </div>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search music..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-200"
                aria-label="Search music"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => {
                  setShowFilterDropdown(!showFilterDropdown);
                  setShowSortDropdown(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground hover:border-primary focus:outline-none focus:border-primary transition-colors duration-200"
                aria-haspopup="true"
                aria-expanded={showFilterDropdown}
              >
                <Filter className="w-4 h-4" />
                <span>Filter</span>
                <SortAsc className="w-4 h-4" />
              </button>
              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                  {GENRES.map(genre => (
                    <button
                      key={genre}
                      onClick={() => {
                        setFilterGenre(genre);
                        setShowFilterDropdown(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors duration-200 capitalize"
                    >
                      {genre === 'all' ? 'All Genres' : genre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowSortDropdown(!showSortDropdown);
                  setShowFilterDropdown(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground hover:border-primary focus:outline-none focus:border-primary transition-colors duration-200"
                aria-haspopup="true"
                aria-expanded={showSortDropdown}
              >
                <SortAsc className="w-4 h-4" />
                <span>Sort</span>
                <SortAsc className="w-4 h-4" />
              </button>
              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                  {SORT_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortDropdown(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors duration-200"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Your Library</h2>
          <span className="text-sm text-muted-foreground">
            {filteredTracks.length} track{filteredTracks.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Music className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">No tracks found</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="space-y-1" role="list" aria-label="Music tracks">
            {filteredTracks.map((track, index) => (
              <div
                key={track.id}
                onClick={() => playTrack(track)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    playTrack(track);
                  }
                }}
                className={`group flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted transition-colors duration-200 cursor-pointer ${
                  currentTrack?.id === track.id ? 'bg-muted' : ''
                }`}
                role="listitem"
                tabIndex={0}
              >
                <div className="w-8 text-center flex-shrink-0">
                  {currentTrack?.id === track.id && isPlaying ? (
                    <div className="flex items-center justify-center gap-0.5 h-4">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="w-0.5 bg-green-500 rounded-full animate-pulse"
                          style={{
                            animationDelay: `${i * 0.15}s`,
                            height: `${4 + Math.random() * 12}px`,
                          }}
                        />
                      ))}
                    </div>
                  ) : currentTrack?.id === track.id ? (
                    <Play className="w-5 h-5 mx-auto text-green-500" />
                  ) : (
                    <span className="text-sm text-muted-foreground group-hover:hidden">{index + 1}</span>
                  )}
                  {currentTrack?.id !== track.id && (
                    <Play className="w-5 h-5 mx-auto text-foreground hidden group-hover:block" />
                  )}
                </div>
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary to-secondary">
                  <img 
                    src={track.thumbnail} 
                    alt={`${track.album} cover`} 
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    currentTrack?.id === track.id ? 'text-green-500' : 'text-foreground'
                  }`}>
                    {track.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                </div>
                <div className="w-32 text-xs text-muted-foreground truncate hidden sm:block">{track.album}</div>
                <div className="w-16 text-sm text-muted-foreground text-right">{formatTime(track.duration)}</div>
                <button
                  className="p-2 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200"
                  aria-label="More options"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

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
                onClick={() => setShuffle(!shuffle)}
                className={`p-2 transition-colors duration-200 ${
                  shuffle ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Shuffle"
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <button
                onClick={playPrevious}
                className="p-2 text-foreground hover:text-green-500 transition-colors duration-200"
                aria-label="Previous track"
              >
                <SkipBack className="w-6 h-6" />
              </button>
              <button
                onClick={togglePlay}
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
                onClick={playNext}
                className="p-2 text-foreground hover:text-green-500 transition-colors duration-200"
                aria-label="Next track"
              >
                <SkipForward className="w-6 h-6" />
              </button>
              <button
                onClick={() => setRepeat(!repeat)}
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
                onChange={(e) => handleProgressChange(parseFloat(e.target.value))}
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
              onClick={toggleMute}
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
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-green-500 hover:accent-green-400 transition-colors"
              aria-label="Volume"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
