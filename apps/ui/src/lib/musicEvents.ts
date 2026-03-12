import type { Track } from '@/components/MediaPlayer';

export type MusicEventType = 'track:open' | 'track:delete' | 'track:properties' | 'track:formatConvert' | 'track:editTags';

export const MUSIC_EVENT_NAMES: Record<MusicEventType, MusicEventType> = {
  'track:open': 'track:open',
  'track:delete': 'track:delete',
  'track:properties': 'track:properties',
  'track:formatConvert': 'track:formatConvert',
  'track:editTags': 'track:editTags',
};

export interface BaseMusicEventDetail {
  trackId: number;
  timestamp: number;
}

export interface TrackOpenEventDetail extends BaseMusicEventDetail {
  trackPath?: string;
  trackTitle: string;
}

export interface TrackDeleteEventDetail extends BaseMusicEventDetail {
  trackPath?: string;
  trackTitle: string;
}

export interface TrackPropertiesEventDetail extends BaseMusicEventDetail {
  trackPath?: string;
  trackTitle: string;
}

export interface TrackFormatConvertEventDetail extends BaseMusicEventDetail {
  trackPath?: string;
  trackTitle: string;
}

export interface TrackEditTagsEventDetail extends BaseMusicEventDetail {
  trackPath?: string;
  trackTitle: string;
}

export type MusicEventDetail = 
  | TrackOpenEventDetail 
  | TrackDeleteEventDetail 
  | TrackPropertiesEventDetail 
  | TrackFormatConvertEventDetail
  | TrackEditTagsEventDetail;

export function createTrackOpenEvent(track: Track): CustomEvent<TrackOpenEventDetail> {
  return new CustomEvent<TrackOpenEventDetail>(MUSIC_EVENT_NAMES['track:open'], {
    bubbles: true,
    composed: true,
    detail: {
      trackId: track.id,
      timestamp: Date.now(),
      trackPath: track.path,
      trackTitle: track.title,
    },
  });
}

export function createTrackDeleteEvent(track: Track): CustomEvent<TrackDeleteEventDetail> {
  return new CustomEvent<TrackDeleteEventDetail>(MUSIC_EVENT_NAMES['track:delete'], {
    bubbles: true,
    composed: true,
    detail: {
      trackId: track.id,
      timestamp: Date.now(),
      trackPath: track.path,
      trackTitle: track.title,
    },
  });
}

export function createTrackPropertiesEvent(track: Track): CustomEvent<TrackPropertiesEventDetail> {
  return new CustomEvent<TrackPropertiesEventDetail>(MUSIC_EVENT_NAMES['track:properties'], {
    bubbles: true,
    composed: true,
    detail: {
      trackId: track.id,
      timestamp: Date.now(),
      trackPath: track.path,
      trackTitle: track.title,
    },
  });
}

export function emitMusicEvent(event: CustomEvent<MusicEventDetail>): void {
  document.dispatchEvent(event);
}

export function emitTrackOpenEvent(track: Track): void {
  const event = createTrackOpenEvent(track);
  emitMusicEvent(event);
}

export function emitTrackDeleteEvent(track: Track): void {
  const event = createTrackDeleteEvent(track);
  emitMusicEvent(event);
}

export function emitTrackPropertiesEvent(track: Track): void {
  const event = createTrackPropertiesEvent(track);
  emitMusicEvent(event);
}

export function createTrackFormatConvertEvent(track: Track): CustomEvent<TrackFormatConvertEventDetail> {
  return new CustomEvent<TrackFormatConvertEventDetail>(MUSIC_EVENT_NAMES['track:formatConvert'], {
    bubbles: true,
    composed: true,
    detail: {
      trackId: track.id,
      timestamp: Date.now(),
      trackPath: track.path,
      trackTitle: track.title,
    },
  });
}

export function emitTrackFormatConvertEvent(track: Track): void {
  const event = createTrackFormatConvertEvent(track);
  emitMusicEvent(event);
}

export function createTrackEditTagsEvent(track: Track): CustomEvent<TrackEditTagsEventDetail> {
  return new CustomEvent<TrackEditTagsEventDetail>(MUSIC_EVENT_NAMES['track:editTags'], {
    bubbles: true,
    composed: true,
    detail: {
      trackId: track.id,
      timestamp: Date.now(),
      trackPath: track.path,
      trackTitle: track.title,
    },
  });
}

export function emitTrackEditTagsEvent(track: Track): void {
  const event = createTrackEditTagsEvent(track);
  emitMusicEvent(event);
}

export function addMusicEventListener<T extends MusicEventDetail>(
  eventType: MusicEventType,
  listener: (event: CustomEvent<T>) => void
): () => void {
  const handler = (event: Event) => {
    listener(event as CustomEvent<T>);
  };
  
  document.addEventListener(eventType, handler);
  
  return () => {
    document.removeEventListener(eventType, handler);
  };
}
