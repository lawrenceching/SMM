import { isElectron } from "@/lib/isElectron"

export interface NativeDialogFileItem {
  name: string
  path: string
  isDirectory: boolean
}

export interface NativeOpenDialogOptions {
  title?: string
  defaultPath?: string
  properties?: Array<"openFile" | "openDirectory" | "multiSelections">
  filters?: Array<{ name: string; extensions: string[] }>
}

function getElectronDialog():
  | {
      showOpenDialog: (
        options: NativeOpenDialogOptions,
      ) => Promise<{ canceled: boolean; filePaths?: string[] }>
    }
  | undefined {
  if (!isElectron()) {
    return undefined
  }

  return (window as Window & { electron?: { dialog?: { showOpenDialog: typeof Function } } })
    .electron?.dialog as
    | {
        showOpenDialog: (
          options: NativeOpenDialogOptions,
        ) => Promise<{ canceled: boolean; filePaths?: string[] }>
      }
    | undefined
}

function toFileItem(path: string, isDirectory: boolean): NativeDialogFileItem {
  const name = path.split(/[/\\]/).pop() || path
  return { name, path, isDirectory }
}

export async function openNativeOpenDialog(
  options: NativeOpenDialogOptions,
): Promise<NativeDialogFileItem | null> {
  const dialog = getElectronDialog()
  if (!dialog?.showOpenDialog) {
    return null
  }

  try {
    const result = await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths?.length) {
      return null
    }

    const path = result.filePaths[0]
    const isDirectory = options.properties?.includes("openDirectory") ?? false
    return toFileItem(path, isDirectory)
  } catch (error) {
    console.error("[openNativeOpenDialog] failed:", error)
    return null
  }
}

export async function openNativeFolderDialog(options?: {
  title?: string
}): Promise<NativeDialogFileItem | null> {
  return openNativeOpenDialog({
    properties: ["openDirectory"],
    title: options?.title ?? "Select Folder",
  })
}
