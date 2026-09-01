import { useCallback, useEffect, useState } from "react"
import { UIScrapeDialog, useScrapeDialog } from "@/components/dialogs"
import {
  UI_AskForScrape,
  type OnAskForScrapeEventData,
} from "@/types/eventTypes"

/**
 * Top-level owner of the metadata scrape flow (rendered once at App level).
 *
 * The TV / movie headers only dispatch a {@link UI_AskForScrape} document
 * event carrying the folder's media metadata; this component owns the dialog
 * UI state and runs the scrape orchestration (tasks derivation, job polling,
 * cancel/start) via `useScrapeDialog` — decoupled from the requesting panels.
 */
export function ScrapeMetadata() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<OnAskForScrapeEventData>({})

  const openFromRequest = useCallback((detail: OnAskForScrapeEventData | undefined) => {
    setOptions({
      mediaMetadata: detail?.mediaMetadata,
      title: detail?.title,
      description: detail?.description,
    })
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      openFromRequest((event as CustomEvent<OnAskForScrapeEventData>).detail)
    }
    document.addEventListener(UI_AskForScrape, handler)
    return () => {
      document.removeEventListener(UI_AskForScrape, handler)
    }
  }, [openFromRequest])

  const scrape = useScrapeDialog({
    isOpen,
    onClose: close,
    mediaMetadata: options.mediaMetadata,
  })

  return (
    <UIScrapeDialog
      isOpen={isOpen}
      onClose={close}
      tasks={scrape.tasks}
      isRunning={scrape.isRunning}
      allTasksDone={scrape.allTasksDone}
      showButtons={scrape.showButtons}
      cancelDisabled={scrape.cancelDisabled}
      canDismissIncidentally={scrape.canDismissIncidentally}
      onCancel={scrape.handleCancel}
      onStart={scrape.handleStart}
    />
  )
}
