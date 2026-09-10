import {
  UI_AskForFormatConverter,
  UI_AskForRenameFile,
  UI_AskForScrape,
  type OnAskForFormatConverterEventData,
  type OnAskForRenameFileEventData,
  type OnAskForScrapeEventData,
  type RenameFileDialogOptions,
} from "@/types/eventTypes"

/**
 * Document-event dispatchers for the App-level dialog controllers
 * (`FormatConverter`, `ScrapeMetadata`, `RenameFile`). Panels / headers /
 * menu items call these instead of opening dialogs via dialog-provider,
 * which keeps the feature decoupled from the panels that request it.
 */

export function askForFormatConverter(detail: OnAskForFormatConverterEventData = {}): void {
  document.dispatchEvent(
    new CustomEvent<OnAskForFormatConverterEventData>(UI_AskForFormatConverter, { detail }),
  )
}

export function askForScrape(detail: OnAskForScrapeEventData): void {
  document.dispatchEvent(new CustomEvent<OnAskForScrapeEventData>(UI_AskForScrape, { detail }))
}

export function askForRenameFile(
  onConfirm: (newName: string) => void,
  options?: RenameFileDialogOptions,
): void {
  const detail: OnAskForRenameFileEventData = { onConfirm, options }
  document.dispatchEvent(new CustomEvent<OnAskForRenameFileEventData>(UI_AskForRenameFile, { detail }))
}
