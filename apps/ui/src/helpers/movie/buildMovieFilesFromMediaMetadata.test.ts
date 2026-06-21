import { describe, it, expect } from "vitest"
import type { MediaMetadata } from "@core/types"
import { buildMovieFilesFromMediaMetadata } from "./buildMovieFilesFromMediaMetadata"

describe("buildMovieFilesFromMediaMetadata", () => {
  const mediaFolderPath = "/movies/Inception"

  it("returns undefined when mediaMetadata is undefined", () => {
    expect(buildMovieFilesFromMediaMetadata(undefined)).toBeUndefined()
  })

  it("returns undefined when mediaFolderPath is missing", () => {
    const mediaMetadata: MediaMetadata = {
      mediaFiles: [{ absolutePath: "/movies/Inception/Inception.mkv" }],
    }

    expect(buildMovieFilesFromMediaMetadata(mediaMetadata)).toBeUndefined()
  })

  it("returns empty files when mediaFiles is empty", () => {
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath,
      type: "movie-folder",
      mediaFiles: [],
      files: [],
    }

    expect(buildMovieFilesFromMediaMetadata(mediaMetadata)).toEqual({ files: [] })
  })

  it("builds video file entry without associated files", () => {
    const videoPath = `${mediaFolderPath}/Inception.mkv`
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath,
      type: "movie-folder",
      mediaFiles: [{ absolutePath: videoPath }],
      files: [videoPath],
    }

    expect(buildMovieFilesFromMediaMetadata(mediaMetadata)).toEqual({
      files: [{ type: "video", path: videoPath, newPath: undefined }],
    })
  })

  it("includes associated subtitle and nfo files for the video", () => {
    const videoPath = `${mediaFolderPath}/Inception.mkv`
    const subtitlePath = `${mediaFolderPath}/Inception.en.srt`
    const nfoPath = `${mediaFolderPath}/Inception.nfo`
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath,
      type: "movie-folder",
      mediaFiles: [{ absolutePath: videoPath }],
      files: [videoPath, subtitlePath, nfoPath],
    }

    expect(buildMovieFilesFromMediaMetadata(mediaMetadata)).toEqual({
      files: [
        { type: "video", path: videoPath, newPath: undefined },
        { type: "subtitle", path: subtitlePath, newPath: undefined },
        { type: "nfo", path: nfoPath, newPath: undefined },
      ],
    })
  })

  it("includes poster and audio associated files", () => {
    const videoPath = `${mediaFolderPath}/Inception.mkv`
    const posterPath = `${mediaFolderPath}/Inception.jpg`
    const audioPath = `${mediaFolderPath}/Inception.mka`
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath,
      type: "movie-folder",
      mediaFiles: [{ absolutePath: videoPath }],
      files: [videoPath, posterPath, audioPath],
    }

    expect(buildMovieFilesFromMediaMetadata(mediaMetadata)).toEqual({
      files: [
        { type: "video", path: videoPath, newPath: undefined },
        { type: "poster", path: posterPath, newPath: undefined },
        { type: "audio", path: audioPath, newPath: undefined },
      ],
    })
  })

  it("includes movie-folder standard files (movie.nfo, poster.jpg, fanart.jpg)", () => {
    const videoPath = `${mediaFolderPath}/the-jester-f.mp4`
    const nfoPath = `${mediaFolderPath}/movie.nfo`
    const posterPath = `${mediaFolderPath}/poster.jpg`
    const fanartPath = `${mediaFolderPath}/fanart.jpg`
    const mediaMetadata: MediaMetadata = {
      mediaFolderPath,
      type: "movie-folder",
      mediaFiles: [{ absolutePath: videoPath }],
      files: [fanartPath, nfoPath, posterPath, videoPath],
    }

    expect(buildMovieFilesFromMediaMetadata(mediaMetadata)).toEqual({
      files: [
        { type: "video", path: videoPath, newPath: undefined },
        { type: "nfo", path: nfoPath, newPath: undefined },
        { type: "poster", path: posterPath, newPath: undefined },
        { type: "poster", path: fanartPath, newPath: undefined },
      ],
    })
  })
})
