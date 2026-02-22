import { Play, MoreVertical, Music, FolderOpen, Trash2, FileText } from 'lucide-react';
import type { Track } from './MediaPlayer';
import Image from './Image';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu';
import { useTranslation } from '@/lib/i18n';
import { useDialogs } from '@/providers/dialog-provider';

export interface MediaPlayerTrackListProps {
  filteredTracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  mode: 'view' | 'player';
  onTrackClick: (track: Track) => void;
  formatTime: (seconds: number) => string;
  onTrackOpen?: (track: Track) => void;
  onTrackDelete?: (track: Track) => void;
}

interface TrackListItemProps {
  track: Track;
  index: number;
  currentTrack: Track | null;
  isPlaying: boolean;
  mode: 'view' | 'player';
  onTrackClick: (track: Track) => void;
  formatTime: (seconds: number) => string;
  onTrackOpen?: (track: Track) => void;
  onTrackDelete?: (track: Track) => void;
}

function TrackListItem({
  track,
  index,
  currentTrack,
  isPlaying,
  mode,
  onTrackClick,
  formatTime,
  onTrackOpen,
  onTrackDelete
}: TrackListItemProps) {
  const { t } = useTranslation('components');
  const [openFileProperty] = useDialogs().filePropertyDialog;
  const isActive = currentTrack?.id === track.id;
  const showPlayButton = isActive && isPlaying && mode === 'player';
  const showPauseIcon = isActive && mode === 'player';

  const handleOpen = () => {
    onTrackOpen?.(track);
  };

  const handleDelete = () => {
    onTrackDelete?.(track);
  };

  const handleProperties = () => {
    openFileProperty(track);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={mode === 'player' ? () => onTrackClick(track) : undefined}
          onKeyDown={(e) => {
            if (mode !== 'player') return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onTrackClick(track);
            }
          }}
          className={`group flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted transition-colors duration-200 ${
            mode === 'player' ? 'cursor-pointer' : ''
          } ${isActive ? 'bg-muted' : ''}`}
          role="listitem"
          tabIndex={mode === 'player' ? 0 : -1}
        >
          <div className="w-8 text-center flex-shrink-0">
            {showPlayButton ? (
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
            ) : showPauseIcon ? (
              <Play className="w-5 h-5 mx-auto text-green-500" />
            ) : (
              <span className="text-sm text-muted-foreground group-hover:hidden">{index + 1}</span>
            )}
            {!isActive && mode === 'player' && (
              <Play className="w-5 h-5 mx-auto text-foreground hidden group-hover:block" />
            )}
          </div>
          <div className="w-[120px] h-[60px] rounded overflow-hidden flex-shrink-0 from-primary to-secondary">
            <Image
              url={track.thumbnail}
              alt={`${track.album} cover`}
              placeholder="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3C/svg%3E"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${
              isActive ? 'text-green-500' : 'text-foreground'
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
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleOpen}>
          <FolderOpen className="w-4 h-4 mr-2" />
          {t('mediaPlayer.trackContextMenu.open')}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleProperties}>
          <FileText className="w-4 h-4 mr-2" />
          {t('mediaPlayer.trackContextMenu.properties')}
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 className="w-4 h-4 mr-2" />
          {t('mediaPlayer.trackContextMenu.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function MediaPlayerTrackList({
  filteredTracks,
  currentTrack,
  isPlaying,
  mode,
  onTrackClick,
  formatTime,
  onTrackOpen,
  onTrackDelete
}: MediaPlayerTrackListProps) {
  const { t } = useTranslation('components');

  if (filteredTracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Music className="w-16 h-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-lg">{t('mediaPlayer.noTracksFound')}</p>
        <p className="text-muted-foreground/60 text-sm mt-1">{t('mediaPlayer.tryAdjustingFilter')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1" role="list" aria-label="Music tracks">
      {filteredTracks.map((track, index) => (
        <TrackListItem
          key={track.id}
          track={track}
          index={index}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          mode={mode}
          onTrackClick={onTrackClick}
          formatTime={formatTime}
          onTrackOpen={onTrackOpen}
          onTrackDelete={onTrackDelete}
        />
      ))}
    </div>
  );
}
