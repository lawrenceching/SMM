import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Track } from '@/components/MediaPlayer';
import {
  MUSIC_EVENT_NAMES,
  createTrackOpenEvent,
  createTrackDeleteEvent,
  createTrackPropertiesEvent,
  emitTrackOpenEvent,
  emitTrackDeleteEvent,
  emitTrackPropertiesEvent,
  addMusicEventListener,
  type TrackOpenEventDetail,
  type TrackDeleteEventDetail,
  type TrackPropertiesEventDetail,
} from './musicEvents';

describe('musicEvents', () => {
  let mockTrack: Track;

  beforeEach(() => {
    mockTrack = {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MUSIC_EVENT_NAMES', () => {
    it('should have correct event names', () => {
      expect(MUSIC_EVENT_NAMES['track:open']).toBe('track:open');
      expect(MUSIC_EVENT_NAMES['track:delete']).toBe('track:delete');
      expect(MUSIC_EVENT_NAMES['track:properties']).toBe('track:properties');
    });

    it('should have correct types', () => {
      expect(MUSIC_EVENT_NAMES['track:open']).toEqual('track:open');
      expect(MUSIC_EVENT_NAMES['track:delete']).toEqual('track:delete');
      expect(MUSIC_EVENT_NAMES['track:properties']).toEqual('track:properties');
    });
  });

  describe('createTrackOpenEvent', () => {
    it('should create a CustomEvent with correct detail', () => {
      const event = createTrackOpenEvent(mockTrack);

      expect(event.type).toBe(MUSIC_EVENT_NAMES['track:open']);
      expect(event.detail).toEqual<TrackOpenEventDetail>({
        trackId: mockTrack.id,
        timestamp: expect.any(Number),
        trackPath: mockTrack.path,
        trackTitle: mockTrack.title,
      });
    });

    it('should have bubbles and composed set to true', () => {
      const event = createTrackOpenEvent(mockTrack);

      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    });

    it('should handle track without path', () => {
      const trackWithoutPath = { ...mockTrack, path: undefined };
      const event = createTrackOpenEvent(trackWithoutPath);

      expect(event.detail.trackPath).toBeUndefined();
    });
  });

  describe('createTrackDeleteEvent', () => {
    it('should create a CustomEvent with correct detail', () => {
      const event = createTrackDeleteEvent(mockTrack);

      expect(event.type).toBe(MUSIC_EVENT_NAMES['track:delete']);
      expect(event.detail).toEqual<TrackDeleteEventDetail>({
        trackId: mockTrack.id,
        timestamp: expect.any(Number),
        trackPath: mockTrack.path,
        trackTitle: mockTrack.title,
      });
    });

    it('should have bubbles and composed set to true', () => {
      const event = createTrackDeleteEvent(mockTrack);

      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    });
  });

  describe('createTrackPropertiesEvent', () => {
    it('should create a CustomEvent with correct detail', () => {
      const event = createTrackPropertiesEvent(mockTrack);

      expect(event.type).toBe(MUSIC_EVENT_NAMES['track:properties']);
      expect(event.detail).toEqual<TrackPropertiesEventDetail>({
        trackId: mockTrack.id,
        timestamp: expect.any(Number),
        trackPath: mockTrack.path,
        trackTitle: mockTrack.title,
      });
    });

    it('should have bubbles and composed set to true', () => {
      const event = createTrackPropertiesEvent(mockTrack);

      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    });
  });

  describe('emitTrackOpenEvent', () => {
    it('should dispatch the event to document', () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

      emitTrackOpenEvent(mockTrack);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'track:open',
          detail: expect.objectContaining({
            trackId: mockTrack.id,
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          }),
        })
      );
    });
  });

  describe('emitTrackDeleteEvent', () => {
    it('should dispatch the event to document', () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

      emitTrackDeleteEvent(mockTrack);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'track:delete',
          detail: expect.objectContaining({
            trackId: mockTrack.id,
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          }),
        })
      );
    });
  });

  describe('emitTrackPropertiesEvent', () => {
    it('should dispatch the event to document', () => {
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

      emitTrackPropertiesEvent(mockTrack);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'track:properties',
          detail: expect.objectContaining({
            trackId: mockTrack.id,
            trackPath: mockTrack.path,
            trackTitle: mockTrack.title,
          }),
        })
      );
    });
  });

  describe('addMusicEventListener', () => {
    it('should add event listener to document', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const listener = vi.fn();

      const unsubscribe = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        MUSIC_EVENT_NAMES['track:open'],
        expect.any(Function)
      );

      unsubscribe();
    });

    it('should call listener when event is dispatched', () => {
      const listener = vi.fn();
      const unsubscribe = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener
      );

      const event = createTrackOpenEvent(mockTrack);
      document.dispatchEvent(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);

      unsubscribe();
    });

    it('should remove event listener when unsubscribe is called', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const listener = vi.fn();

      const unsubscribe = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener
      );

      unsubscribe();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        MUSIC_EVENT_NAMES['track:open'],
        expect.any(Function)
      );
    });

    it('should not call listener after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener
      );

      unsubscribe();

      const event = createTrackOpenEvent(mockTrack);
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle different event types independently', () => {
      const openListener = vi.fn();
      const deleteListener = vi.fn();

      const unsubscribeOpen = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        openListener
      );
      const unsubscribeDelete = addMusicEventListener<TrackDeleteEventDetail>(
        MUSIC_EVENT_NAMES['track:delete'],
        deleteListener
      );

      const openEvent = createTrackOpenEvent(mockTrack);
      document.dispatchEvent(openEvent);

      expect(openListener).toHaveBeenCalledTimes(1);
      expect(deleteListener).not.toHaveBeenCalled();

      const deleteEvent = createTrackDeleteEvent(mockTrack);
      document.dispatchEvent(deleteEvent);

      expect(openListener).toHaveBeenCalledTimes(1);
      expect(deleteListener).toHaveBeenCalledTimes(1);

      unsubscribeOpen();
      unsubscribeDelete();
    });
  });

  describe('Event propagation', () => {
    it('should allow events to bubble through DOM', () => {
      const listener = vi.fn();
      const unsubscribe = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener
      );

      const event = createTrackOpenEvent(mockTrack);
      document.dispatchEvent(event);

      expect(event.bubbles).toBe(true);
      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('should allow events to cross shadow DOM boundaries', () => {
      const event = createTrackOpenEvent(mockTrack);

      expect(event.composed).toBe(true);
    });
  });

  describe('Event detail structure', () => {
    it('should include timestamp in event detail', () => {
      const beforeTime = Date.now();
      const event = createTrackOpenEvent(mockTrack);
      const afterTime = Date.now();

      expect(event.detail.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(event.detail.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should maintain track data integrity across event creation', () => {
      const event = createTrackOpenEvent(mockTrack);

      expect(event.detail.trackId).toBe(mockTrack.id);
      expect(event.detail.trackTitle).toBe(mockTrack.title);
      expect(event.detail.trackPath).toBe(mockTrack.path);
    });
  });

  describe('Multiple event listeners', () => {
    it('should support multiple listeners for the same event type', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      const unsubscribe1 = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener1
      );
      const unsubscribe2 = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener2
      );
      const unsubscribe3 = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener3
      );

      const event = createTrackOpenEvent(mockTrack);
      document.dispatchEvent(event);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    });

    it('should call listeners in the order they were added', () => {
      const callOrder: number[] = [];
      const listener1 = vi.fn(() => callOrder.push(1));
      const listener2 = vi.fn(() => callOrder.push(2));
      const listener3 = vi.fn(() => callOrder.push(3));

      const unsubscribe1 = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener1
      );
      const unsubscribe2 = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener2
      );
      const unsubscribe3 = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener3
      );

      const event = createTrackOpenEvent(mockTrack);
      document.dispatchEvent(event);

      expect(callOrder).toEqual([1, 2, 3]);

      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    });
  });

  describe('Event emission integration', () => {
    it('should work end-to-end: emit -> listen -> receive', () => {
      const receivedEvents: CustomEvent<TrackOpenEventDetail>[] = [];
      
      const unsubscribe = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        (event) => {
          receivedEvents.push(event);
        }
      );

      emitTrackOpenEvent(mockTrack);
      emitTrackOpenEvent(mockTrack);
      emitTrackOpenEvent(mockTrack);

      expect(receivedEvents).toHaveLength(3);
      receivedEvents.forEach(event => {
        expect(event.detail.trackId).toBe(mockTrack.id);
        expect(event.detail.trackTitle).toBe(mockTrack.title);
      });

      unsubscribe();
    });

    it('should handle rapid event emissions', () => {
      const listener = vi.fn();
      const unsubscribe = addMusicEventListener<TrackOpenEventDetail>(
        MUSIC_EVENT_NAMES['track:open'],
        listener
      );

      for (let i = 0; i < 100; i++) {
        emitTrackOpenEvent(mockTrack);
      }

      expect(listener).toHaveBeenCalledTimes(100);

      unsubscribe();
    });
  });
});
