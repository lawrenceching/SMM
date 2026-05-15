import { describe, it, expect } from 'vitest'
import type { Track } from '@/components/MediaPlayer'
import { syncTracks } from './musicPanelSyncTracks'

describe('syncTracks', () => {
  it('scenario 1: should return same tracks when prev tracks is same as localTracks', () => {
    const prev: Track[] = [
      {
        id: 1,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 2,
        title: 'Song 2',
        artist: 'Artist 2',
        duration: 200,
        thumbnail: 'thumb2.jpg',
        addedDate: new Date('2024-01-02'),
        path: '/music/song2.mp3',
      },
    ]

    const localTracks: Track[] = [
      {
        id: 3,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 4,
        title: 'Song 2',
        artist: 'Artist 2',
        duration: 200,
        thumbnail: 'thumb2.jpg',
        addedDate: new Date('2024-01-02'),
        path: '/music/song2.mp3',
      },
    ]

    const result = syncTracks(prev, localTracks)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[0].path).toBe('/music/song1.mp3')
    expect(result[1].id).toBe(2)
    expect(result[1].path).toBe('/music/song2.mp3')
  })

  it('scenario 2: should remove deleted tracks when one item in prev tracks is not in localTracks', () => {
    const prev: Track[] = [
      {
        id: 1,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 2,
        title: 'Song 2',
        artist: 'Artist 2',
        duration: 200,
        thumbnail: 'thumb2.jpg',
        addedDate: new Date('2024-01-02'),
        path: '/music/song2.mp3',
      },
      {
        id: 3,
        title: 'Downloading Song',
        artist: 'Unknown',
        duration: 0,
        thumbnail: '',
        addedDate: new Date('2024-01-03'),
        path: '',
        url: 'https://example.com/video',
        status: 'downloading',
      },
    ]

    const localTracks: Track[] = [
      {
        id: 4,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
    ]

    const result = syncTracks(prev, localTracks)

    expect(result).toHaveLength(2)

    const song1 = result.find((t) => t.path === '/music/song1.mp3')
    expect(song1).toBeDefined()
    expect(song1?.id).toBe(1)

    const downloadingTrack = result.find((t) => t.status === 'downloading')
    expect(downloadingTrack).toBeDefined()
    expect(downloadingTrack?.url).toBe('https://example.com/video')
  })

  it('scenario 3: should add new tracks when one item in localTracks is not in prev tracks', () => {
    const prev: Track[] = [
      {
        id: 1,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
    ]

    const localTracks: Track[] = [
      {
        id: 2,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 3,
        title: 'Song 2',
        artist: 'Artist 2',
        duration: 200,
        thumbnail: 'thumb2.jpg',
        addedDate: new Date('2024-01-02'),
        path: '/music/song2.mp3',
      },
    ]

    const result = syncTracks(prev, localTracks)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[0].path).toBe('/music/song1.mp3')
    expect(result[1].id).toBe(3)
    expect(result[1].path).toBe('/music/song2.mp3')
    expect(result[1].title).toBe('Song 2')
  })

  it('scenario 4: should update track properties when item with same path has changed metadata', () => {
    const prev: Track[] = [
      {
        id: 1,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 2,
        title: 'Old Title',
        artist: 'Old Artist',
        duration: 100,
        thumbnail: 'old-thumb.jpg',
        addedDate: new Date('2024-01-02'),
        path: '/music/song2.mp3',
      },
    ]

    const localTracks: Track[] = [
      {
        id: 3,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 4,
        title: 'New Title',
        artist: 'New Artist',
        duration: 250,
        thumbnail: 'new-thumb.jpg',
        addedDate: new Date('2024-01-05'),
        path: '/music/song2.mp3',
      },
    ]

    const result = syncTracks(prev, localTracks)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[0].title).toBe('Song 1')

    expect(result[1].id).toBe(2)
    expect(result[1].title).toBe('New Title')
    expect(result[1].artist).toBe('New Artist')
    expect(result[1].duration).toBe(250)
    expect(result[1].thumbnail).toBe('new-thumb.jpg')
    expect(result[1].addedDate).toEqual(new Date('2024-01-05'))
  })

  it('scenario 5: should replace completed temporary track with local track', () => {
    const prev: Track[] = [
      {
        id: 1,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 2,
        title: 'Downloading Song',
        artist: 'Unknown',
        duration: 0,
        thumbnail: '',
        addedDate: new Date('2024-01-03'),
        path: '/music/downloaded.mp3',
        url: 'https://example.com/video',
        status: 'completed',
      },
    ]

    const localTracks: Track[] = [
      {
        id: 3,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 4,
        title: 'Downloaded Song',
        artist: 'Real Artist',
        duration: 220,
        thumbnail: 'downloaded-thumb.jpg',
        addedDate: new Date('2024-01-04'),
        path: '/music/downloaded.mp3',
      },
    ]

    const result = syncTracks(prev, localTracks)

    expect(result).toHaveLength(2)

    const completedTrack = result.find((t) => t.id === 2)
    expect(completedTrack).toBeDefined()
    expect(completedTrack?.title).toBe('Downloaded Song')
    expect(completedTrack?.artist).toBe('Real Artist')
    expect(completedTrack?.duration).toBe(220)
    expect(completedTrack?.path).toBe('/music/downloaded.mp3')
    expect(completedTrack?.status).toBeUndefined()
    expect(completedTrack?.url).toBeUndefined()
  })

  it('should keep pending temporary tracks when local track is not loaded yet', () => {
    const prev: Track[] = [
      {
        id: 1,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 2,
        title: 'Pending Download',
        artist: 'Unknown',
        duration: 0,
        thumbnail: '',
        addedDate: new Date('2024-01-03'),
        path: '',
        url: 'https://example.com/video',
        status: 'pending',
      },
    ]

    const localTracks: Track[] = [
      {
        id: 3,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
    ]

    const result = syncTracks(prev, localTracks)

    expect(result).toHaveLength(2)

    const pendingTrack = result.find((t) => t.status === 'pending')
    expect(pendingTrack).toBeDefined()
    expect(pendingTrack?.url).toBe('https://example.com/video')
  })

  it('should keep downloading temporary tracks', () => {
    const prev: Track[] = [
      {
        id: 1,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 2,
        title: 'Downloading Song',
        artist: 'Unknown',
        duration: 0,
        thumbnail: '',
        addedDate: new Date('2024-01-03'),
        path: '',
        url: 'https://example.com/video',
        status: 'downloading',
      },
    ]

    const localTracks: Track[] = [
      {
        id: 3,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
    ]

    const result = syncTracks(prev, localTracks)

    expect(result).toHaveLength(2)

    const downloadingTrack = result.find((t) => t.status === 'downloading')
    expect(downloadingTrack).toBeDefined()
    expect(downloadingTrack?.url).toBe('https://example.com/video')
  })

  it('should handle empty prev tracks', () => {
    const prev: Track[] = []

    const localTracks: Track[] = [
      {
        id: 1,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 2,
        title: 'Song 2',
        artist: 'Artist 2',
        duration: 200,
        thumbnail: 'thumb2.jpg',
        addedDate: new Date('2024-01-02'),
        path: '/music/song2.mp3',
      },
    ]

    const result = syncTracks(prev, localTracks)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe(2)
  })

  it('should handle empty localTracks and keep only temporary tracks', () => {
    const prev: Track[] = [
      {
        id: 1,
        title: 'Song 1',
        artist: 'Artist 1',
        duration: 180,
        thumbnail: 'thumb1.jpg',
        addedDate: new Date('2024-01-01'),
        path: '/music/song1.mp3',
      },
      {
        id: 2,
        title: 'Downloading Song',
        artist: 'Unknown',
        duration: 0,
        thumbnail: '',
        addedDate: new Date('2024-01-03'),
        path: '',
        url: 'https://example.com/video',
        status: 'downloading',
      },
    ]

    const localTracks: Track[] = []

    const result = syncTracks(prev, localTracks)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(2)
    expect(result[0].status).toBe('downloading')
    expect(result[0].url).toBe('https://example.com/video')
  })
})
