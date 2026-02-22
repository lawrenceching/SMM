import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MusicPanel } from './MusicPanel'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

let mockSelectedMediaMetadata: UIMediaMetadata | undefined = undefined

vi.mock('@/providers/media-metadata-provider', () => ({
  useMediaMetadata: vi.fn(() => ({
    selectedMediaMetadata: mockSelectedMediaMetadata,
    updateMediaMetadata: vi.fn(),
    refreshMediaMetadata: vi.fn(),
    setSelectedMediaMetadataByMediaFolderPath: vi.fn(),
  })),
}))

vi.mock('./MediaPlayer', () => ({
  MediaPlayer: vi.fn(({ tracks }: { tracks: any }) => (
    <div data-testid="media-player" data-tracks={tracks === undefined ? 'undefined' : JSON.stringify(tracks)}>
      MediaPlayer
    </div>
  )),
}))

describe('MusicPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectedMediaMetadata = undefined
  })

  it('should render without errors', () => {
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    expect(mediaPlayer).toBeInTheDocument()
  })

  it('should render MediaPlayer with undefined tracks when selectedMediaMetadata is undefined', () => {
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    expect(mediaPlayer).toBeInTheDocument()
    const tracksData = mediaPlayer.getAttribute('data-tracks')
    expect(tracksData).toBe('undefined')
  })

  it('should render MediaPlayer with tracks when selectedMediaMetadata is defined', () => {
    const testMediaMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: [
        '/media/music/album/song1.mp3',
        '/media/music/album/song2.mp3',
      ],
    }
    
    mockSelectedMediaMetadata = testMediaMetadata
    
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    expect(mediaPlayer).toBeInTheDocument()
    
    const tracksData = mediaPlayer.getAttribute('data-tracks')
    expect(tracksData).toBeDefined()
    const parsedTracks = JSON.parse(tracksData!)
    expect(parsedTracks).toHaveLength(2)
  })

  it('should create tracks from selectedMediaMetadata', () => {
    const testMediaMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      mediaName: 'My Album',
      files: [
        '/media/music/album/song1.mp3',
        '/media/music/album/song1.jpg',
      ],
    }
    
    mockSelectedMediaMetadata = testMediaMetadata
    
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    const tracksData = mediaPlayer.getAttribute('data-tracks')
    const parsedTracks = JSON.parse(tracksData!)
    
    expect(parsedTracks).toHaveLength(1)
    expect(parsedTracks[0].id).toBe(0)
    expect(parsedTracks[0].title).toBe('song1.mp3')
    expect(parsedTracks[0].artist).toBe('')
    expect(parsedTracks[0].album).toBe('')
    expect(parsedTracks[0].thumbnail).toBe('file:///media/music/album/song1.jpg')
  })

  it('should have correct container structure', () => {
    const { container } = render(<MusicPanel />)
    
    const containerDiv = container.firstChild as HTMLElement
    expect(containerDiv).toBeInTheDocument()
    expect(containerDiv).toHaveStyle({
      flex: '1',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    })
  })

  it('should update tracks when selectedMediaMetadata changes', () => {
    const initialMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album1',
      type: 'music-folder',
      files: ['/media/music/album1/song1.mp3'],
    }
    
    mockSelectedMediaMetadata = initialMetadata
    
    const { rerender } = render(<MusicPanel />)
    
    let mediaPlayer = screen.getByTestId('media-player')
    let tracksData = mediaPlayer.getAttribute('data-tracks')
    let parsedTracks = JSON.parse(tracksData!)
    
    expect(parsedTracks).toHaveLength(1)
    expect(parsedTracks[0].title).toBe('song1.mp3')
    
    const updatedMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album2',
      type: 'music-folder',
      files: ['/media/music/album2/song2.mp3'],
    }
    
    mockSelectedMediaMetadata = updatedMetadata
    rerender(<MusicPanel />)
    
    mediaPlayer = screen.getByTestId('media-player')
    tracksData = mediaPlayer.getAttribute('data-tracks')
    parsedTracks = JSON.parse(tracksData!)
    
    expect(parsedTracks).toHaveLength(1)
    expect(parsedTracks[0].title).toBe('song2.mp3')
  })

  it('should handle empty files array', () => {
    const testMediaMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/empty-album',
      type: 'music-folder',
      files: [],
    }
    
    mockSelectedMediaMetadata = testMediaMetadata
    
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    const tracksData = mediaPlayer.getAttribute('data-tracks')
    const parsedTracks = JSON.parse(tracksData!)
    
    expect(parsedTracks).toEqual([])
  })

  it('should handle files being undefined', () => {
    const testMediaMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: undefined,
    }
    
    mockSelectedMediaMetadata = testMediaMetadata
    
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    const tracksData = mediaPlayer.getAttribute('data-tracks')
    const parsedTracks = JSON.parse(tracksData!)
    
    expect(parsedTracks).toEqual([])
  })

  it('should filter out non-media files', () => {
    const testMediaMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: [
        '/media/music/album/song1.mp3',
        '/media/music/album/lyrics.txt',
        '/media/music/album/info.md',
      ],
    }
    
    mockSelectedMediaMetadata = testMediaMetadata
    
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    const tracksData = mediaPlayer.getAttribute('data-tracks')
    const parsedTracks = JSON.parse(tracksData!)
    
    expect(parsedTracks).toHaveLength(1)
    expect(parsedTracks[0].title).toBe('song1.mp3')
  })

  it('should handle video files', () => {
    const testMediaMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/videos',
      type: 'music-folder',
      files: [
        '/media/music/videos/video1.mp4',
        '/media/music/videos/video2.mkv',
      ],
    }
    
    mockSelectedMediaMetadata = testMediaMetadata
    
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    const tracksData = mediaPlayer.getAttribute('data-tracks')
    const parsedTracks = JSON.parse(tracksData!)
    
    expect(parsedTracks).toHaveLength(2)
    expect(parsedTracks[0].title).toBe('video1.mp4')
    expect(parsedTracks[1].title).toBe('video2.mkv')
  })

  it('should handle mixed audio and video files', () => {
    const testMediaMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/mixed',
      type: 'music-folder',
      files: [
        '/media/music/mixed/song1.mp3',
        '/media/music/mixed/video1.mp4',
        '/media/music/mixed/song2.flac',
      ],
    }
    
    mockSelectedMediaMetadata = testMediaMetadata
    
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    const tracksData = mediaPlayer.getAttribute('data-tracks')
    const parsedTracks = JSON.parse(tracksData!)
    
    expect(parsedTracks).toHaveLength(3)
    expect(parsedTracks[0].title).toBe('video1.mp4')
    expect(parsedTracks[1].title).toBe('song1.mp3')
    expect(parsedTracks[2].title).toBe('song2.flac')
  })

  it('should convert musicFiles to tracks with correct properties', () => {
    const testMediaMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      mediaName: 'Test Album',
      files: ['/media/music/album/song1.mp3'],
    }
    
    mockSelectedMediaMetadata = testMediaMetadata
    
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    const tracksData = mediaPlayer.getAttribute('data-tracks')
    const parsedTracks = JSON.parse(tracksData!)
    
    expect(parsedTracks).toHaveLength(1)
    expect(parsedTracks[0].id).toBe(0)
    expect(parsedTracks[0].title).toBe('song1.mp3')
    expect(parsedTracks[0].artist).toBe('')
    expect(parsedTracks[0].album).toBe('')
    expect(parsedTracks[0].duration).toBe(0)
    expect(parsedTracks[0].genre).toBe('unknown')
    expect(parsedTracks[0].thumbnail).toBe('https://picsum.photos/seed/default/200')
    expect(parsedTracks[0].addedDate).toBeDefined()
  })
})
