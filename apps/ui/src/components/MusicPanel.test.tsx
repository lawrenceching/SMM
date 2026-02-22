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
  MediaPlayer: vi.fn(({ mediaMetadata }: { mediaMetadata: any }) => (
    <div data-testid="media-player" data-media-metadata={mediaMetadata === undefined ? 'undefined' : JSON.stringify(mediaMetadata)}>
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

  it('should render MediaPlayer with undefined mediaMetadata when selectedMediaMetadata is undefined', () => {
    render(<MusicPanel />)
    
    const mediaPlayer = screen.getByTestId('media-player')
    expect(mediaPlayer).toBeInTheDocument()
    const mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    expect(mediaMetadataData).toBe('undefined')
  })

  it('should render MediaPlayer with musicMediaMetadata when selectedMediaMetadata is defined', () => {
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
    
    const mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    expect(mediaMetadataData).toBeDefined()
    expect(mediaMetadataData).toContain('musicFiles')
  })

  it('should create musicMediaMetadata from selectedMediaMetadata', () => {
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
    const mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    const parsedData = JSON.parse(mediaMetadataData!)
    
    expect(parsedData.mediaFolderPath).toBe('/media/music/album')
    expect(parsedData.mediaName).toBe('My Album')
    expect(parsedData.type).toBe('music-folder')
    expect(parsedData.musicFiles).toHaveLength(1)
    expect(parsedData.musicFiles[0].type).toBe('audio')
    expect(parsedData.musicFiles[0].path).toBe('/media/music/album/song1.mp3')
    expect(parsedData.musicFiles[0].thumbnailUri).toBe('file:///media/music/album/song1.jpg')
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

  it('should update musicMediaMetadata when selectedMediaMetadata changes', () => {
    const initialMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album1',
      type: 'music-folder',
      files: ['/media/music/album1/song1.mp3'],
    }
    
    mockSelectedMediaMetadata = initialMetadata
    
    const { rerender } = render(<MusicPanel />)
    
    let mediaPlayer = screen.getByTestId('media-player')
    let mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    let parsedData = JSON.parse(mediaMetadataData!)
    
    expect(parsedData.mediaFolderPath).toBe('/media/music/album1')
    
    const updatedMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album2',
      type: 'music-folder',
      files: ['/media/music/album2/song2.mp3'],
    }
    
    mockSelectedMediaMetadata = updatedMetadata
    rerender(<MusicPanel />)
    
    mediaPlayer = screen.getByTestId('media-player')
    mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    parsedData = JSON.parse(mediaMetadataData!)
    
    expect(parsedData.mediaFolderPath).toBe('/media/music/album2')
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
    const mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    const parsedData = JSON.parse(mediaMetadataData!)
    
    expect(parsedData.musicFiles).toEqual([])
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
    const mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    const parsedData = JSON.parse(mediaMetadataData!)
    
    expect(parsedData.musicFiles).toEqual([])
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
    const mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    const parsedData = JSON.parse(mediaMetadataData!)
    
    expect(parsedData.musicFiles).toHaveLength(1)
    expect(parsedData.musicFiles[0].path).toBe('/media/music/album/song1.mp3')
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
    const mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    const parsedData = JSON.parse(mediaMetadataData!)
    
    expect(parsedData.musicFiles).toHaveLength(2)
    expect(parsedData.musicFiles[0].type).toBe('video')
    expect(parsedData.musicFiles[1].type).toBe('video')
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
    const mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    const parsedData = JSON.parse(mediaMetadataData!)
    
    expect(parsedData.musicFiles).toHaveLength(3)
    expect(parsedData.musicFiles[0].type).toBe('video')
    expect(parsedData.musicFiles[1].type).toBe('audio')
    expect(parsedData.musicFiles[2].type).toBe('audio')
  })

  it('should preserve all UIMediaMetadata properties', () => {
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
    const mediaMetadataData = mediaPlayer.getAttribute('data-media-metadata')
    const parsedData = JSON.parse(mediaMetadataData!)
    
    expect(parsedData.status).toBe('ok')
    expect(parsedData.mediaFolderPath).toBe('/media/music/album')
    expect(parsedData.type).toBe('music-folder')
    expect(parsedData.mediaName).toBe('Test Album')
    expect(parsedData.musicFiles).toBeDefined()
  })
})
