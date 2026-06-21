import type { Track } from '@/components/MediaPlayer'

/**
 * Reassigns colliding track ids so row selection and React keys stay stable per file.
 * New files from {@link convertMusicFilesToTracks} use array indices that can duplicate
 * ids preserved from a previous folder snapshot after files are added or removed.
 */
function assignUniqueTrackIds(tracks: Track[]): Track[] {
  const used = new Set<number>()
  let maxId = -1
  for (const t of tracks) {
    if (t.id > maxId) maxId = t.id
  }
  return tracks.map((track) => {
    if (!used.has(track.id)) {
      used.add(track.id)
      return track
    }
    let newId = maxId + 1
    while (used.has(newId)) newId += 1
    used.add(newId)
    maxId = newId
    return { ...track, id: newId }
  })
}

/** Merge library tracks with in-flight download job tracks for MusicPanel. */
export function syncTracks(prev: Track[], localTracks: Track[]) {
  let tracks = prev

  const prevPermanentTracks = tracks.filter((track) => track.status === undefined)
  const deletedTracks = prevPermanentTracks.filter(
    (prevTrack) => !localTracks.some((newTrack) => newTrack.path === prevTrack.path),
  )
  tracks = tracks.filter(
    (track) => track.status !== undefined || !deletedTracks.some((dt) => dt.path === track.path),
  )

  tracks = tracks.map((track) => {
    if (track.status !== undefined) {
      return track
    }

    const localMatch = localTracks.find((lt) => lt.path === track.path)
    return localMatch ? { ...localMatch, id: track.id } : track
  })

  const newTracks = localTracks.filter(
    (newTrack) => !prev.some((prevTrack) => prevTrack.path === newTrack.path),
  )
  tracks = [...tracks, ...newTracks]

  tracks = tracks.map((track) => {
    if (track.status === undefined) {
      return track
    }

    if (track.status === 'completed') {
      const localMatch = localTracks.find((lt) => lt.path === track.path)
      if (localMatch) {
        return {
          ...localMatch,
          id: track.id,
          status: undefined,
          url: undefined,
        }
      }
    }

    return track
  })

  return assignUniqueTrackIds(tracks)
}
