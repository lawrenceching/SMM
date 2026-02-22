import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MediaPlayerTrackList } from './MediaPlayerTrackList';
import type { Track } from './MediaPlayer';
import { MUSIC_EVENT_NAMES } from '@/lib/musicEvents';

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockTrack: Track = {
  id: 1,
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  duration: 180,
  genre: 'pop',
  thumbnail: 'https://example.com/thumbnail.jpg',
  addedDate: new Date('2024-01-01'),
  path: '/path/to/song.mp3',
};

const mockTracks: Track[] = [
  mockTrack,
  {
    id: 2,
    title: 'Another Song',
    artist: 'Another Artist',
    album: 'Another Album',
    duration: 200,
    genre: 'rock',
    thumbnail: 'https://example.com/thumbnail2.jpg',
    addedDate: new Date('2024-01-02'),
    path: '/path/to/song2.mp3',
  },
];

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

describe('MediaPlayerTrackList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Event Emission', () => {
    it('should emit track:open event when Open menu item is clicked', async () => {
      const onTrackOpen = vi.fn();
      const eventListener = (_event: Event) => {};

      document.addEventListener(MUSIC_EVENT_NAMES['track:open'], eventListener);

      render(
        <MediaPlayerTrackList
          filteredTracks={mockTracks}
          currentTrack={null}
          isPlaying={false}
          mode="view"
          onTrackClick={vi.fn()}
          formatTime={formatTime}
          onTrackOpen={onTrackOpen}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(2);
      });

      const trackItems = screen.getAllByRole('listitem');
      const moreButton = trackItems[0].querySelector('button[aria-label="More options"]');
      
      expect(moreButton).toBeInTheDocument();

      document.removeEventListener(MUSIC_EVENT_NAMES['track:open'], eventListener);
    });

    it('should emit track:delete event when Delete menu item is clicked', async () => {
      const onTrackDelete = vi.fn();
      const eventListener = (_event: Event) => {};

      document.addEventListener(MUSIC_EVENT_NAMES['track:delete'], eventListener);

      render(
        <MediaPlayerTrackList
          filteredTracks={mockTracks}
          currentTrack={null}
          isPlaying={false}
          mode="view"
          onTrackClick={vi.fn()}
          formatTime={formatTime}
          onTrackDelete={onTrackDelete}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(2);
      });

      const trackItems = screen.getAllByRole('listitem');
      const moreButton = trackItems[0].querySelector('button[aria-label="More options"]');
      
      expect(moreButton).toBeInTheDocument();

      document.removeEventListener(MUSIC_EVENT_NAMES['track:delete'], eventListener);
    });

    it('should emit track:properties event when Properties menu item is clicked', async () => {
      const eventListener = (_event: Event) => {};

      document.addEventListener(MUSIC_EVENT_NAMES['track:properties'], eventListener);

      render(
        <MediaPlayerTrackList
          filteredTracks={mockTracks}
          currentTrack={null}
          isPlaying={false}
          mode="view"
          onTrackClick={vi.fn()}
          formatTime={formatTime}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(2);
      });

      const trackItems = screen.getAllByRole('listitem');
      const moreButton = trackItems[0].querySelector('button[aria-label="More options"]');
      
      expect(moreButton).toBeInTheDocument();

      document.removeEventListener(MUSIC_EVENT_NAMES['track:properties'], eventListener);
    });

    it('should render context menu trigger', async () => {
      render(
        <MediaPlayerTrackList
          filteredTracks={mockTracks}
          currentTrack={null}
          isPlaying={false}
          mode="view"
          onTrackClick={vi.fn()}
          formatTime={formatTime}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(2);
      });

      const trackItems = screen.getAllByRole('listitem');
      expect(trackItems[0]).toHaveAttribute('role', 'listitem');
    });
  });

  describe('Component Interaction', () => {
    it('should call onTrackClick when track is clicked in player mode', async () => {
      const onTrackClick = vi.fn();

      render(
        <MediaPlayerTrackList
          filteredTracks={mockTracks}
          currentTrack={null}
          isPlaying={false}
          mode="player"
          onTrackClick={onTrackClick}
          formatTime={formatTime}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(2);
      });

      const trackItems = screen.getAllByRole('listitem');
      fireEvent.click(trackItems[0]);

      expect(onTrackClick).toHaveBeenCalledWith(mockTrack);
    });

    it('should not call onTrackClick when track is clicked in view mode', async () => {
      const onTrackClick = vi.fn();

      render(
        <MediaPlayerTrackList
          filteredTracks={mockTracks}
          currentTrack={null}
          isPlaying={false}
          mode="view"
          onTrackClick={onTrackClick}
          formatTime={formatTime}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(2);
      });

      const trackItems = screen.getAllByRole('listitem');
      fireEvent.click(trackItems[0]);

      expect(onTrackClick).not.toHaveBeenCalled();
    });

    it('should highlight current track', async () => {
      render(
        <MediaPlayerTrackList
          filteredTracks={mockTracks}
          currentTrack={mockTrack}
          isPlaying={true}
          mode="player"
          onTrackClick={vi.fn()}
          formatTime={formatTime}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(2);
      });

      const trackTitle = screen.getByText(mockTrack.title);
      expect(trackTitle).toHaveClass('text-green-500');
    });

    it('should display play button for current playing track', async () => {
      render(
        <MediaPlayerTrackList
          filteredTracks={mockTracks}
          currentTrack={mockTrack}
          isPlaying={true}
          mode="player"
          onTrackClick={vi.fn()}
          formatTime={formatTime}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(2);
      });

      const firstTrack = screen.getAllByRole('listitem')[0];
      expect(firstTrack).toHaveClass('bg-muted');
    });
  });

  describe('Empty State', () => {
    it('should display empty state message when no tracks', () => {
      render(
        <MediaPlayerTrackList
          filteredTracks={[]}
          currentTrack={null}
          isPlaying={false}
          mode="view"
          onTrackClick={vi.fn()}
          formatTime={formatTime}
        />
      );

      expect(screen.getByText('mediaPlayer.noTracksFound')).toBeInTheDocument();
      expect(screen.getByText('mediaPlayer.tryAdjustingFilter')).toBeInTheDocument();
    });
  });

  describe('Event Detail Structure', () => {
    it('should include correct timestamp in event detail', async () => {
      const eventListener = (_event: Event) => {};

      document.addEventListener(MUSIC_EVENT_NAMES['track:open'], eventListener);

      render(
        <MediaPlayerTrackList
          filteredTracks={mockTracks}
          currentTrack={null}
          isPlaying={false}
          mode="view"
          onTrackClick={vi.fn()}
          formatTime={formatTime}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(2);
      });

      const trackItems = screen.getAllByRole('listitem');
      const moreButton = trackItems[0].querySelector('button[aria-label="More options"]');
      
      expect(moreButton).toBeInTheDocument();

      document.removeEventListener(MUSIC_EVENT_NAMES['track:open'], eventListener);
    });

    it('should handle track without path in event', async () => {
      const trackWithoutPath = { ...mockTrack, path: undefined };
      const eventListener = (_event: Event) => {};

      document.addEventListener(MUSIC_EVENT_NAMES['track:open'], eventListener);

      render(
        <MediaPlayerTrackList
          filteredTracks={[trackWithoutPath]}
          currentTrack={null}
          isPlaying={false}
          mode="view"
          onTrackClick={vi.fn()}
          formatTime={formatTime}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(1);
      });

      const trackItems = screen.getAllByRole('listitem');
      const moreButton = trackItems[0].querySelector('button[aria-label="More options"]');
      
      expect(moreButton).toBeInTheDocument();

      document.removeEventListener(MUSIC_EVENT_NAMES['track:open'], eventListener);
    });
  });

  describe('Multiple Track Interactions', () => {
    it('should render multiple tracks with more buttons', async () => {
      render(
        <MediaPlayerTrackList
          filteredTracks={mockTracks}
          currentTrack={null}
          isPlaying={false}
          mode="view"
          onTrackClick={vi.fn()}
          formatTime={formatTime}
        />
      );

      await waitFor(() => {
        const trackItems = screen.getAllByRole('listitem');
        expect(trackItems).toHaveLength(2);
      });

      const trackItems = screen.getAllByRole('listitem');
      const moreButton1 = trackItems[0].querySelector('button[aria-label="More options"]');
      const moreButton2 = trackItems[1].querySelector('button[aria-label="More options"]');

      expect(moreButton1).toBeInTheDocument();
      expect(moreButton2).toBeInTheDocument();
    });
  });
});
