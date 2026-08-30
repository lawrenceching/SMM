import type { MediaMetadata, ProblemDetails } from "@core/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  MetadataHttpError,
  createMetadata,
  deleteMetadata,
  getMetadata,
  setMetadata,
} from "./metadata"

const metadata: MediaMetadata = {
  mediaFolderPath: "/media/show",
  type: "tvshow-folder",
  mediaFiles: [],
}

describe("metadata HTTP API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts a path to get metadata and forwards the abort signal", async () => {
    const signal = new AbortController().signal
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: metadata }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    await expect(getMetadata("/media/show", signal)).resolves.toEqual(metadata)
    expect(fetch).toHaveBeenCalledWith(
      "/api/get-metadata",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path: "/media/show" }),
        signal,
      }),
    )
  })

  it("throws MetadataHttpError containing ProblemDetails", async () => {
    const problem: ProblemDetails = {
      type: "https://smm/errors/metadata-not-found",
      title: "Metadata not found",
      status: 404,
      detail: "No metadata for /media/missing",
      instance: "/api/get-metadata",
    }
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(problem), {
        status: 404,
        headers: { "Content-Type": "application/problem+json" },
      }),
    )

    const error = await getMetadata("/media/missing").catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(MetadataHttpError)
    expect(error).toMatchObject({ status: 404, problem })
  })

  it("uses create, set, and delete RPC request shapes", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ data: metadata }))
      .mockResolvedValueOnce(Response.json({ data: { ...metadata, type: "movie-folder" } }))
      .mockResolvedValueOnce(Response.json({ data: true }))

    await expect(createMetadata(metadata)).resolves.toEqual(metadata)
    await expect(
      setMetadata("/media/show", {
        type: "movie-folder",
        mediaFiles: [],
      }),
    ).resolves.toMatchObject({ type: "movie-folder" })
    await expect(deleteMetadata("/media/show")).resolves.toBeUndefined()

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/create-metadata",
      expect.objectContaining({ body: JSON.stringify({ data: metadata }) }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/set-metadata",
      expect.objectContaining({
        body: JSON.stringify({
          path: "/media/show",
          patch: { type: "movie-folder", mediaFiles: [] },
        }),
      }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/delete-metadata",
      expect.objectContaining({ body: JSON.stringify({ path: "/media/show" }) }),
    )
  })

  it("strips UI-only keys before create-metadata", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ data: metadata }))

    await createMetadata({
      ...metadata,
      // UIMediaMetadata fields must not reach the strict Zod create schema
      status: "ok",
      files: ["/media/show/a.mkv"],
    } as MediaMetadata & { status: string; files: string[] })

    expect(fetch).toHaveBeenCalledWith(
      "/api/create-metadata",
      expect.objectContaining({
        body: JSON.stringify({
          data: {
            mediaFolderPath: metadata.mediaFolderPath,
            type: metadata.type,
            mediaFiles: metadata.mediaFiles,
            tvShow: undefined,
            movie: undefined,
          },
        }),
      }),
    )
  })
})
