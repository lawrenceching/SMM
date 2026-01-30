import { EVENT_ON_MEDIA_FOLDER_IMPORTED, type UIEventHandler, type UIEvent, EVENT_APP_START_UP, EVENT_ON_MEDIA_FOLDER_SELECTED } from "@/types/EventHandlerTypes"
import { useInitializeMediaFolderEventHandler } from "./eventhandlers/useInitializeMediaFolderEventHandler"
import { useDialogs } from "@/providers/dialog-provider"
import { useMemo } from "react"
import { useMediaFolderSelectedEventHanlder } from "./eventhandlers/useMediaFolderSelectedEventHandler"

export function useEventHandlers() {

  const { configDialog } = useDialogs()

  const intializeMediaFolderEventHandler = useInitializeMediaFolderEventHandler()
  const mediaFolderSelectedEventHandler = useMediaFolderSelectedEventHanlder()

  const handlers = useMemo<Record<string, UIEventHandler[]>>(() => {
    return {
      [EVENT_APP_START_UP]: [
        {
          name: 'appStartUp',
          handler: async (): Promise<void> => {},
        },
      ],
      [EVENT_ON_MEDIA_FOLDER_IMPORTED]: [
        {
          name: 'initializeMediaFolder',
          handler: intializeMediaFolderEventHandler,
        },
      ],
      [EVENT_ON_MEDIA_FOLDER_SELECTED]: [
        {
          name: 'initializeMediaFolder',
          handler: mediaFolderSelectedEventHandler,
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
