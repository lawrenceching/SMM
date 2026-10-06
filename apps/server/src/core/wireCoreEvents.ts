import { MEDIA_METADATA_UPDATED_EVENT, type Core } from '@smm/core'
import { broadcast } from '@/utils/socketIO'

/** Forwards Core events to Socket.IO (Web UI / Electron / ohos). */
export function wireCoreEvents(core: Core): void {
  core.on(MEDIA_METADATA_UPDATED_EVENT, (data) => {
    if (!data.folderPath) return
    broadcast({
      event: MEDIA_METADATA_UPDATED_EVENT,
      data: { folderPath: data.folderPath },
    })
  })
}
