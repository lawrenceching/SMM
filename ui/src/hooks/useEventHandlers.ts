import { EVENT_ON_MEDIA_FOLDER_IMPORTED, type UIEventHandler, type UIEvent } from "@/types/EventHandlerTypes"
import { useInitializeMediaFolderEventHandler } from "./eventhandlers/useInitializeMediaFolderEventHandler"
import { useDialogs } from "@/providers/dialog-provider"
import { useMemo } from "react"

export function useEventHandlers() {

  const { configDialog } = useDialogs()
  const intializeMediaFolderEventHandler = useInitializeMediaFolderEventHandler()

  const handlers = useMemo<Record<string, UIEventHandler[]>>(() => {
    return {
      [EVENT_ON_MEDIA_FOLDER_IMPORTED]: [
        {
          name: 'initializeMediaFolder',
          handler: intializeMediaFolderEventHandler,
        },
      ],
    }
  }, [])

  const postEvent = (event: UIEvent) => {
    console.log(`[useEventHandlers] dispatch event`, event)
    const handler = handlers[event.name]
    if(handler) {
      handler.forEach((h: UIEventHandler) => h.handler(event))
    } else {
      console.error(`[useEventHandlers] No handler found for event: ${event.name}`)
    }
  }

  const onRequireToOpenConfigDialog = () => {
    const [openConfig] = configDialog
    openConfig("ai")
  }

  return { onRequireToOpenConfigDialog, postEvent }
}
