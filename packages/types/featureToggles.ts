export interface HelloFeatures {
  ytdlp: boolean
  videocaptioner: boolean
}

/** Product switches returned by hello. Both default off. */
export function featureToggles(): HelloFeatures {
  return {
    ytdlp: false,
    videocaptioner: false,
  }
}
