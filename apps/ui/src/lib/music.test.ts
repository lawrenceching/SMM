import { describe, it, expect } from 'vitest'
import { findFilesByFileName, findFilesByExtensions, findThumbnail, buildMusicFilePropsArray, newMusicMediaMetadata } from './music'
import type { MusicFileProps, MusicMediaMetadata } from '@/types/MusicMediaMetadata'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

describe('findFilesByFileName', () => {
  it('should return empty array when no files match', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.mp3',
    ]
    const result = findFilesByFileName(files, 'nonexistent')
    expect(result).toEqual([])
  })

  it('should return single matching file', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.mp3',
    ]
    const result = findFilesByFileName(files, 'song1')
    expect(result).toEqual(['/media/music/song1.mp3'])
  })

  it('should return multiple matching files with same base name but different extensions', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song1.flac',
      '/media/music/song1.wav',
      '/media/music/song2.mp3',
    ]
    const result = findFilesByFileName(files, 'song1')
    expect(result).toEqual([
      '/media/music/song1.mp3',
      '/media/music/song1.flac',
      '/media/music/song1.wav',
    ])
  })

  it('should handle files with no extension', () => {
    const files = [
      '/media/music/song1',
      '/media/music/song2.mp3',
    ]
    const result = findFilesByFileName(files, 'song1')
    expect(result).toEqual(['/media/music/song1'])
  })

  it('should handle empty files array', () => {
    const files: string[] = []
    const result = findFilesByFileName(files, 'song1')
    expect(result).toEqual([])
  })

  it('should handle files in different directories', () => {
    const files = [
      '/media/music/album1/song1.mp3',
      '/media/music/album2/song1.mp3',
      '/media/music/album3/song1.mp3',
    ]
    const result = findFilesByFileName(files, 'song1')
    expect(result).toEqual([
      '/media/music/album1/song1.mp3',
      '/media/music/album2/song1.mp3',
      '/media/music/album3/song1.mp3',
    ])
  })

  it('should be case-sensitive', () => {
    const files = [
      '/media/music/Song1.mp3',
      '/media/music/song1.mp3',
      '/media/music/SONG1.mp3',
    ]
    const result = findFilesByFileName(files, 'song1')
    expect(result).toEqual(['/media/music/song1.mp3'])
  })

  it('should handle files with multiple dots in name', () => {
    const files = [
      '/media/music/song.1.mp3',
      '/media/music/song.1.flac',
      '/media/music/song.2.mp3',
    ]
    const result = findFilesByFileName(files, 'song.1')
    expect(result).toEqual([
      '/media/music/song.1.mp3',
      '/media/music/song.1.flac',
    ])
  })

  it('should handle complex file paths', () => {
    const files = [
      '/media/music/artist/album/01.song1.mp3',
      '/media/music/artist/album/02.song2.mp3',
      '/media/music/artist/album/disc1/01.song1.mp3',
    ]
    const result = findFilesByFileName(files, '01.song1')
    expect(result).toEqual([
      '/media/music/artist/album/01.song1.mp3',
      '/media/music/artist/album/disc1/01.song1.mp3',
    ])
  })

  it('should return all files when all match', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song1.flac',
      '/media/music/song1.wav',
    ]
    const result = findFilesByFileName(files, 'song1')
    expect(result).toEqual(files)
    expect(result.length).toBe(3)
  })
})

describe('findFilesByExtensions', () => {
  it('should return empty array when no files match', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.flac',
    ]
    const result = findFilesByExtensions(files, ['.wav'])
    expect(result).toEqual([])
  })

  it('should return single matching file', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.flac',
      '/media/music/song3.wav',
    ]
    const result = findFilesByExtensions(files, ['.mp3'])
    expect(result).toEqual(['/media/music/song1.mp3'])
  })

  it('should return multiple files with same extension', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.mp3',
      '/media/music/song3.flac',
    ]
    const result = findFilesByExtensions(files, ['.mp3'])
    expect(result).toEqual([
      '/media/music/song1.mp3',
      '/media/music/song2.mp3',
    ])
  })

  it('should return files with multiple extensions', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.flac',
      '/media/music/song3.wav',
      '/media/music/song4.m4a',
      '/media/music/song5.txt',
    ]
    const result = findFilesByExtensions(files, ['.mp3', '.flac', '.wav'])
    expect(result).toEqual([
      '/media/music/song1.mp3',
      '/media/music/song2.flac',
      '/media/music/song3.wav',
    ])
  })

  it('should handle empty files array', () => {
    const files: string[] = []
    const result = findFilesByExtensions(files, ['.mp3'])
    expect(result).toEqual([])
  })

  it('should handle empty extensions array', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.flac',
    ]
    const result = findFilesByExtensions(files, [])
    expect(result).toEqual([])
  })

  it('should filter out files without extensions', () => {
    const files = [
      '/media/music/song1',
      '/media/music/song2',
      '/media/music/song3.mp3',
    ]
    const result = findFilesByExtensions(files, ['.mp3'])
    expect(result).toEqual(['/media/music/song3.mp3'])
  })

  it('should not match files without extensions even when extension list is empty', () => {
    const files = [
      '/media/music/song1',
      '/media/music/song2',
      '/media/music/song3',
    ]
    const result = findFilesByExtensions(files, ['.mp3', '.flac'])
    expect(result).toEqual([])
  })

  it('should be case-sensitive', () => {
    const files = [
      '/media/music/song1.MP3',
      '/media/music/song2.mp3',
      '/media/music/song3.Mp3',
    ]
    const result = findFilesByExtensions(files, ['.mp3'])
    expect(result).toEqual(['/media/music/song2.mp3'])
  })

  it('should handle files in different directories', () => {
    const files = [
      '/media/music/album1/song1.mp3',
      '/media/music/album2/song2.mp3',
      '/media/music/album3/song3.flac',
    ]
    const result = findFilesByExtensions(files, ['.mp3'])
    expect(result).toEqual([
      '/media/music/album1/song1.mp3',
      '/media/music/album2/song2.mp3',
    ])
  })

  it('should handle complex file paths with dots in directory names', () => {
    const files = [
      '/media/music/album.v1/song1.mp3',
      '/media/music/album.v2/song2.mp3',
      '/media/music/album.v3/song3.flac',
    ]
    const result = findFilesByExtensions(files, ['.mp3'])
    expect(result).toEqual([
      '/media/music/album.v1/song1.mp3',
      '/media/music/album.v2/song2.mp3',
    ])
  })

  it('should handle image extensions', () => {
    const files = [
      '/media/album/artwork.jpg',
      '/media/album/artwork.jpeg',
      '/media/album/artwork.png',
      '/media/album/song1.mp3',
    ]
    const result = findFilesByExtensions(files, ['.jpg', '.jpeg', '.png'])
    expect(result).toEqual([
      '/media/album/artwork.jpg',
      '/media/album/artwork.jpeg',
      '/media/album/artwork.png',
    ])
  })

  it('should return all files when all extensions match', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.flac',
      '/media/music/song3.wav',
    ]
    const result = findFilesByExtensions(files, ['.mp3', '.flac', '.wav'])
    expect(result).toEqual(files)
    expect(result.length).toBe(3)
  })

  it('should handle multiple dots in filename', () => {
    const files = [
      '/media/music/song.1.0.mp3',
      '/media/music/song.2.0.flac',
      '/media/music/song.3.0.wav',
    ]
    const result = findFilesByExtensions(files, ['.mp3', '.flac'])
    expect(result).toEqual([
      '/media/music/song.1.0.mp3',
      '/media/music/song.2.0.flac',
    ])
  })

  it('should handle mixed file types', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/album/artwork.jpg',
      '/media/album/lyrics.txt',
      '/media/video/trailer.mp4',
    ]
    const result = findFilesByExtensions(files, ['.mp3'])
    expect(result).toEqual(['/media/music/song1.mp3'])
  })

  it('should preserve original order of files', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.flac',
      '/media/music/song3.mp3',
      '/media/music/song4.wav',
    ]
    const result = findFilesByExtensions(files, ['.mp3', '.wav'])
    expect(result).toEqual([
      '/media/music/song1.mp3',
      '/media/music/song3.mp3',
      '/media/music/song4.wav',
    ])
  })
})

describe('findThumbnail', () => {
  it('should return null when no image files are present', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.flac',
      '/media/album/lyrics.txt',
    ]
    const result = findThumbnail(files)
    expect(result).toBeUndefined()
  })

  it('should return first jpg file', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/album/artwork.jpg',
      '/media/album/lyrics.txt',
    ]
    const result = findThumbnail(files)
    expect(result).toBe('/media/album/artwork.jpg')
  })

  it('should return first png file', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/album/artwork.png',
      '/media/album/lyrics.txt',
    ]
    const result = findThumbnail(files)
    expect(result).toBe('/media/album/artwork.png')
  })

  it('should return first jpeg file', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/album/artwork.jpeg',
      '/media/album/lyrics.txt',
    ]
    const result = findThumbnail(files)
    expect(result).toBe('/media/album/artwork.jpeg')
  })

  it('should return first image file when multiple images exist', () => {
    const files = [
      '/media/album/cover.jpg',
      '/media/album/back.jpg',
      '/media/album/cd.jpg',
    ]
    const result = findThumbnail(files)
    expect(result).toBe('/media/album/cover.jpg')
  })

  it('should return first image file when mixed with other files', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/album/artwork.jpg',
      '/media/music/song2.flac',
      '/media/album/lyrics.txt',
    ]
    const result = findThumbnail(files)
    expect(result).toBe('/media/album/artwork.jpg')
  })

  it('should handle empty array', () => {
    const files: string[] = []
    const result = findThumbnail(files)
    expect(result).toBeUndefined()
  })

  it('should return first image regardless of extension order in path', () => {
    const files = [
      '/media/album/cover.png',
      '/media/album/artwork.jpg',
    ]
    const result = findThumbnail(files)
    expect(result).toBe('/media/album/cover.png')
  })

  it('should handle image files in different directories', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/album/folder1/cover.jpg',
      '/media/album/folder2/back.jpg',
    ]
    const result = findThumbnail(files)
    expect(result).toBe('/media/album/folder1/cover.jpg')
  })

  it('should be case-sensitive', () => {
    const files = [
      '/media/album/artwork.JPG',
      '/media/album/artwork.jpg',
    ]
    const result = findThumbnail(files)
    expect(result).toBe('/media/album/artwork.jpg')
  })
})

describe('buildMusicFilePropsArray', () => {
  it('should return empty array for empty input', () => {
    const files: string[] = []
    const result = buildMusicFilePropsArray(files)
    expect(result).toEqual([])
  })

  it('should return empty array for files without matching extensions', () => {
    const files = [
      '/media/album/lyrics.txt',
      '/media/album/info.md',
    ]
    const result = buildMusicFilePropsArray(files)
    expect(result).toEqual([])
  })

  it('should build props for audio files', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song2.flac',
      '/media/music/song3.wav',
    ]
    const result = buildMusicFilePropsArray(files)
    
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      type: 'audio',
      path: '/media/music/song1.mp3',
      filename: 'song1.mp3',
      title: undefined,
      author: undefined,
      thumbnailUri: 'file://undefined',
      duration: undefined,
    })
    expect(result[1]).toEqual({
      type: 'audio',
      path: '/media/music/song2.flac',
      filename: 'song2.flac',
      title: undefined,
      author: undefined,
      thumbnailUri: 'file://undefined',
      duration: undefined,
    })
    expect(result[2]).toEqual({
      type: 'audio',
      path: '/media/music/song3.wav',
      filename: 'song3.wav',
      title: undefined,
      author: undefined,
      thumbnailUri: 'file://undefined',
      duration: undefined,
    })
  })

  it('should build props for video files', () => {
    const files = [
      '/media/music/video1.mp4',
      '/media/music/video2.mkv',
      '/media/music/video3.avi',
    ]
    const result = buildMusicFilePropsArray(files)
    
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      type: 'video',
      path: '/media/music/video1.mp4',
      filename: 'video1.mp4',
      title: undefined,
      author: undefined,
      thumbnailUri: 'file://undefined',
      duration: undefined,
    })
    expect(result[1]).toEqual({
      type: 'video',
      path: '/media/music/video2.mkv',
      filename: 'video2.mkv',
      title: undefined,
      author: undefined,
      thumbnailUri: 'file://undefined',
      duration: undefined,
    })
    expect(result[2]).toEqual({
      type: 'video',
      path: '/media/music/video3.avi',
      filename: 'video3.avi',
      title: undefined,
      author: undefined,
      thumbnailUri: 'file://undefined',
      duration: undefined,
    })
  })

  it('should build props for mixed audio and video files', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/video1.mp4',
      '/media/music/song2.flac',
      '/media/music/video2.mkv',
    ]
    const result = buildMusicFilePropsArray(files)
    
    expect(result).toHaveLength(4)
    expect(result[0].type).toBe('video')
    expect(result[0].path).toBe('/media/music/video1.mp4')
    expect(result[1].type).toBe('video')
    expect(result[1].path).toBe('/media/music/video2.mkv')
    expect(result[2].type).toBe('audio')
    expect(result[2].path).toBe('/media/music/song1.mp3')
    expect(result[3].type).toBe('audio')
    expect(result[3].path).toBe('/media/music/song2.flac')
  })

  it('should include thumbnail URI when image files are present', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song1.jpg',
    ]
    const result = buildMusicFilePropsArray(files)
    
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'audio',
      path: '/media/music/song1.mp3',
      filename: 'song1.mp3',
    })
    expect(result[0].thumbnailUri).toBe('file:///media/music/song1.jpg')
  })

  it('should find thumbnail from associated files', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/song1.jpg',
      '/media/music/song1.png',
    ]
    const result = buildMusicFilePropsArray(files)
    
    expect(result).toHaveLength(1)
    expect(result[0].thumbnailUri).toBe('file:///media/music/song1.jpg')
  })

  it('should handle files in different directories', () => {
    const files = [
      '/media/music/album1/song1.mp3',
      '/media/music/album2/song2.mp3',
      '/media/music/album1/song1.jpg',
      '/media/music/album2/song2.jpg',
    ]
    const result = buildMusicFilePropsArray(files)
    
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      path: '/media/music/album1/song1.mp3',
      thumbnailUri: 'file:///media/music/album1/song1.jpg',
    })
    expect(result[1]).toMatchObject({
      path: '/media/music/album2/song2.mp3',
      thumbnailUri: 'file:///media/music/album2/song2.jpg',
    })
  })

  it('should set thumbnailUri to undefined when no associated image is found', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/cover.jpg',
    ]
    const result = buildMusicFilePropsArray(files)
    
    expect(result).toHaveLength(1)
    expect(result[0].thumbnailUri).toBe('file://undefined')
  })

  it('should preserve video files before audio files in result', () => {
    const files = [
      '/media/music/song1.mp3',
      '/media/music/video1.mp4',
      '/media/music/song2.mp3',
      '/media/music/video2.mkv',
    ]
    const result = buildMusicFilePropsArray(files)
    
    expect(result).toHaveLength(4)
    expect(result[0].type).toBe('video')
    expect(result[1].type).toBe('video')
    expect(result[2].type).toBe('audio')
    expect(result[3].type).toBe('audio')
  })

  it('should handle files with no extensions', () => {
    const files = [
      '/media/music/song1',
      '/media/music/song2.mp3',
    ]
    const result = buildMusicFilePropsArray(files)
    
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'audio',
      path: '/media/music/song2.mp3',
      filename: 'song2.mp3',
    })
  })

  it('should handle complex file paths with dots in directory names', () => {
    const files = [
      '/media/music/album.v1/song1.mp3',
      '/media/music/album.v1/song1.jpg',
    ]
    const result = buildMusicFilePropsArray(files)
    
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      path: '/media/music/album.v1/song1.mp3',
      filename: 'song1.mp3',
      thumbnailUri: 'file:///media/music/album.v1/song1.jpg',
    })
  })
})

describe('newMusicMediaMetadata', () => {
  it('should create music metadata with empty musicFiles when files is undefined', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.musicFiles).toEqual([])
    expect(result.status).toBe('ok')
    expect(result.mediaFolderPath).toBe('/media/music/album')
    expect(result.type).toBe('music-folder')
  })

  it('should create music metadata with empty musicFiles when files is empty array', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: [],
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.musicFiles).toEqual([])
    expect(result.status).toBe('ok')
    expect(result.mediaFolderPath).toBe('/media/music/album')
    expect(result.type).toBe('music-folder')
  })

  it('should build musicFiles from audio files', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: [
        '/media/music/album/song1.mp3',
        '/media/music/album/song2.flac',
      ],
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.musicFiles).toHaveLength(2)
    expect(result.musicFiles[0]).toMatchObject({
      type: 'audio',
      path: '/media/music/album/song1.mp3',
      filename: 'song1.mp3',
    })
    expect(result.musicFiles[1]).toMatchObject({
      type: 'audio',
      path: '/media/music/album/song2.flac',
      filename: 'song2.flac',
    })
  })

  it('should build musicFiles from video files', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: [
        '/media/music/album/video1.mp4',
        '/media/music/album/video2.mkv',
      ],
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.musicFiles).toHaveLength(2)
    expect(result.musicFiles[0]).toMatchObject({
      type: 'video',
      path: '/media/music/album/video1.mp4',
      filename: 'video1.mp4',
    })
    expect(result.musicFiles[1]).toMatchObject({
      type: 'video',
      path: '/media/music/album/video2.mkv',
      filename: 'video2.mkv',
    })
  })

  it('should build musicFiles from mixed audio and video files', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: [
        '/media/music/album/song1.mp3',
        '/media/music/album/video1.mp4',
        '/media/music/album/song2.flac',
      ],
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.musicFiles).toHaveLength(3)
    expect(result.musicFiles[0].type).toBe('video')
    expect(result.musicFiles[1].type).toBe('audio')
    expect(result.musicFiles[2].type).toBe('audio')
  })

  it('should include thumbnails for associated image files', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: [
        '/media/music/album/song1.mp3',
        '/media/music/album/song1.jpg',
        '/media/music/album/song2.mp3',
        '/media/music/album/song2.png',
      ],
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.musicFiles).toHaveLength(2)
    expect(result.musicFiles[0].thumbnailUri).toBe('file:///media/music/album/song1.jpg')
    expect(result.musicFiles[1].thumbnailUri).toBe('file:///media/music/album/song2.png')
  })

  it('should preserve all original UIMediaMetadata properties', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      mediaName: 'My Album',
      files: ['/media/music/album/song1.mp3'],
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.status).toBe('ok')
    expect(result.mediaFolderPath).toBe('/media/music/album')
    expect(result.type).toBe('music-folder')
    expect(result.mediaName).toBe('My Album')
  })

  it('should filter out non-media files', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: [
        '/media/music/album/song1.mp3',
        '/media/music/album/lyrics.txt',
        '/media/music/album/info.md',
        '/media/music/album/song2.flac',
      ],
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.musicFiles).toHaveLength(2)
    expect(result.musicFiles[0].path).toBe('/media/music/album/song1.mp3')
    expect(result.musicFiles[1].path).toBe('/media/music/album/song2.flac')
  })

  it('should handle files without extensions', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: [
        '/media/music/album/song1',
        '/media/music/album/song2.mp3',
      ],
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.musicFiles).toHaveLength(1)
    expect(result.musicFiles[0].path).toBe('/media/music/album/song2.mp3')
  })

  it('should handle complex file paths with dots in directory names', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album.v1',
      type: 'music-folder',
      files: [
        '/media/music/album.v1/song1.mp3',
        '/media/music/album.v1/song1.jpg',
      ],
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.musicFiles).toHaveLength(1)
    expect(result.musicFiles[0]).toMatchObject({
      path: '/media/music/album.v1/song1.mp3',
      filename: 'song1.mp3',
      thumbnailUri: 'file:///media/music/album.v1/song1.jpg',
    })
  })

  it('should handle musicFiles with undefined thumbnail', () => {
    const uiMetadata: UIMediaMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/music/album',
      type: 'music-folder',
      files: [
        '/media/music/album/song1.mp3',
        '/media/music/album/cover.jpg',
      ],
    }
    
    const result = newMusicMediaMetadata(uiMetadata)
    
    expect(result.musicFiles).toHaveLength(1)
    expect(result.musicFiles[0].thumbnailUri).toBe('file://undefined')
  })
})
