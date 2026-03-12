import * as React from "react"
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { useDialogs } from "@/providers/dialog-provider"
import { useTranslation } from "@/lib/i18n"
// import { cleanUp } from "@/api/cleanUp"
import { toast } from "sonner"
import { hello } from "@/api/hello"
import { openInFileManagerApi } from "@/api/openInFileManager"
import { Path } from "@core/path"
import type { FolderType, FileItem } from "@/providers/dialog-provider"
import { nextTraceId } from "@/lib/utils"
import {
  UI_MediaLibraryImportedEvent,
  type OnMediaLibraryImportedEventData,
} from "@/types/eventTypes"
import { writeFrontendLog } from "@/api/log"

export interface MenuItem {
  name: string
  /** Unique identifier used for id and data-testid attributes */
  id?: string
  onClick?: () => void
  icon?: React.ReactNode
  shortcut?: string
  disabled?: boolean
  inset?: boolean
  variant?: "default" | "destructive"
}

export interface MenuSeparator {
  type: "separator"
}

export interface MenuCheckboxItem {
  type: "checkbox"
  name: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export interface MenuRadioGroup {
  type: "radio-group"
  value?: string
  onValueChange?: (value: string) => void
  items: Array<{
    value: string
    label: string
  }>
}

export interface MenuSubmenu {
  type: "submenu"
  name: string
  items: MenuSubmenuItem[]
}

export type MenuSubmenuItem = MenuItem | MenuSeparator

export type MenuContentItem = MenuItem | MenuSeparator | MenuCheckboxItem | MenuRadioGroup | MenuSubmenu

export interface MenuTemplate {
  label: string
  submenu: MenuContentItem[]
}

function renderMenuItem(item: MenuContentItem, index: number, menuLabel?: string): React.ReactNode {
  if ("type" in item && item.type === "separator") {
    return <MenubarSeparator key={`separator-${index}`} />
  }

  if ("type" in item && item.type === "checkbox") {
    const checkboxItem = item as MenuCheckboxItem
    return (
      <MenubarCheckboxItem
        key={`checkbox-${index}`}
        checked={checkboxItem.checked}
        onCheckedChange={checkboxItem.onCheckedChange}
      >
        {checkboxItem.name}
      </MenubarCheckboxItem>
    )
  }

  if ("type" in item && item.type === "radio-group") {
    const radioGroup = item as MenuRadioGroup
    return (
      <MenubarRadioGroup
        key={`radio-group-${index}`}
        value={radioGroup.value}
        onValueChange={radioGroup.onValueChange}
      >
        {radioGroup.items.map((radioItem) => (
          <MenubarRadioItem key={radioItem.value} value={radioItem.value}>
            {radioItem.label}
          </MenubarRadioItem>
        ))}
      </MenubarRadioGroup>
    )
  }

  if ("type" in item && item.type === "submenu") {
    const submenu = item as MenuSubmenu
    return (
      <MenubarSub key={`submenu-${index}`}>
        <MenubarSubTrigger>{submenu.name}</MenubarSubTrigger>
        <MenubarSubContent>
          {submenu.items.map((subItem, subIndex) => renderMenuItem(subItem, subIndex, menuLabel))}
        </MenubarSubContent>
      </MenubarSub>
    )
  }

  // Regular menu item
  const menuItem = item as MenuItem
  // Use id for both id and data-testid if provided, otherwise generate from menu label and item name
  const itemId = menuItem.id
    ? `menu-${menuLabel?.toLowerCase()}-${menuItem.id}`
    : (menuLabel && menuItem.name
      ? `menu-${menuLabel.toLowerCase()}-${menuItem.name.toLowerCase().replace(/\s+/g, '-')}`
      : undefined)

  return (
    <MenubarItem
      key={`item-${index}`}
      id={itemId}
      disabled={menuItem.disabled}
      inset={menuItem.inset}
      variant={menuItem.variant}
      onClick={menuItem.onClick}
      data-testid={itemId}
    >
      {menuItem.icon && <span className="mr-2">{menuItem.icon}</span>}
      {menuItem.name}
      {menuItem.shortcut && <MenubarShortcut>{menuItem.shortcut}</MenubarShortcut>}
    </MenubarItem>
  )
}




interface MenuProps {
  onOpenFolderMenuClick?: () => void
  onOpenMediaLibraryMenuClick?: () => void
}

export function Menu({onOpenFolderMenuClick, onOpenMediaLibraryMenuClick}: MenuProps) {
  const { configDialog, downloadVideoDialog, formatConverterDialog, openFolderDialog, filePickerDialog } = useDialogs()
  const { t } = useTranslation('components')

  const [openConfig] = configDialog
  const [openDownloadVideo] = downloadVideoDialog
  const [openFormatConverter] = formatConverterDialog
  const [openOpenFolder] = openFolderDialog
  const [openFilePicker] = filePickerDialog

  const logMenuAction = (action: string, context?: Record<string, unknown>) => {
    void writeFrontendLog({
      level: "info",
      message: `menu action: ${action}`,
      context: {
        scope: "menu",
        action,
        ...context,
      },
    })
  }

  const logMenuError = (action: string, error: unknown, context?: Record<string, unknown>) => {
    void writeFrontendLog({
      level: "error",
      message: `menu action failed: ${action}`,
      context: {
        scope: "menu",
        action,
        error: error instanceof Error ? error.message : String(error),
        ...context,
      },
    })
  }

  const handleOpenMediaLibrary = () => {
    logMenuAction("open-media-library.click")
    if (onOpenMediaLibraryMenuClick) {
      onOpenMediaLibraryMenuClick()
    } else {
      openFilePicker((file: FileItem) => {
        logMenuAction("open-media-library.path-selected", { libraryPath: file.path })
        openOpenFolder((type: FolderType) => {
          logMenuAction("open-media-library.type-selected", { libraryPath: file.path, mediaType: type })
          const detail: OnMediaLibraryImportedEventData = {
            libraryPathInPlatformFormat: file.path,
            type,
            traceId: `Menu:UserOpenMediaLibrary:${nextTraceId()}`,
          }
          document.dispatchEvent(new CustomEvent(UI_MediaLibraryImportedEvent, { detail }))
        }, file.path)
      }, {
        title: "Select Media Library",
        description: "Choose a folder containing multiple media folders",
        selectFolder: true
      })
    }
  }

  const template: MenuTemplate[] = [
    {
      label: 'SMM',
      submenu: [
        {
          name: t('menu.openFolder'),
          id: 'open-folder',
          onClick: () => {
            logMenuAction("open-folder.click")
            onOpenFolderMenuClick?.()
          }
        },
        {
          name: t('menu.openMediaLibrary'),
          id: 'open-media-library',
          onClick: handleOpenMediaLibrary
        },
        
        {
          name: t('menu.downloadVideo'),
          id: 'download-video',
          onClick: () => {
            logMenuAction("download-video.click")
            openDownloadVideo((url: string, downloadFolder: string) => {
              console.log(`Downloading video from ${url} to ${downloadFolder}`)
              logMenuAction("download-video.start", { url, downloadFolder })
            })
          }
        },
        {
          name: t('menu.formatConversion'),
          id: 'format-conversion',
          onClick: () => {
            logMenuAction("format-conversion.click")
            openFormatConverter()
          }
        },
        {
          name: t('menu.config'),
          id: 'config',
          onClick: () => {
            logMenuAction("config.click")
            openConfig()
          }
        },
        {
          type: "separator"
        },
        {
          type: "submenu",
          name: t('menu.developer'),
          items: [
            {
              name: t('menu.openAppDataFolder'),
              id: 'open-app-data-folder',
              onClick: async () => {
                logMenuAction("open-app-data-folder.click")
                try {
                  const result = await hello()
                  if (result.error) {
                    toast.error(result.error)
                    logMenuError("open-app-data-folder.hello", result.error)
                    return
                  }
                  // Convert platform path to POSIX format
                  const posixPath = Path.isWindows() ? Path.posix(result.appDataDir) : result.appDataDir
                  const openResult = await openInFileManagerApi(posixPath)
                  if (openResult.error) {
                    toast.error(openResult.error)
                    logMenuError("open-app-data-folder.open-in-file-manager", openResult.error, { path: posixPath })
                  }
                } catch (error) {
                  toast.error(`Failed to open app data folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
                  logMenuError("open-app-data-folder.exception", error)
                }
              }
            },
            {
              name: t('menu.openLogFolder'),
              id: 'open-log-folder',
              onClick: async () => {
                logMenuAction("open-log-folder.click")
                try {
                  const result = await hello()
                  if (result.error) {
                    toast.error(result.error)
                    logMenuError("open-log-folder.hello", result.error)
                    return
                  }
                  // Convert platform path to POSIX format
                  const posixPath = Path.isWindows() ? Path.posix(result.logDir) : result.logDir
                  const openResult = await openInFileManagerApi(posixPath)
                  if (openResult.error) {
                    toast.error(openResult.error)
                    logMenuError("open-log-folder.open-in-file-manager", openResult.error, { path: posixPath })
                  }
                } catch (error) {
                  toast.error(`Failed to open log folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
                  logMenuError("open-log-folder.exception", error)
                }
              }
            },
            {
              type: "separator"
            },
            // {
            //   name: t('menu.cleanUp'),
            //   id: 'clean-up',
            //   onClick: async () => {
            //     logMenuAction("clean-up.click")
            //     try {
            //       const result = await cleanUp()
            //       if (result.success) {
            //         toast.success('Clean up completed successfully')
            //         logMenuAction("clean-up.success")
            //       } else {
            //         toast.error(result.error || 'Clean up failed')
            //         logMenuError("clean-up.failed", result.error || "Clean up failed")
            //       }
            //     } catch (error) {
            //       toast.error(`Failed to clean up: ${error instanceof Error ? error.message : 'Unknown error'}`)
            //       logMenuError("clean-up.exception", error)
            //     }
            //   }
            // }
          ]
        },
        {
          type: "separator"
        },
        {
          name: t('menu.exit'),
          id: 'exit',
          onClick: () => {
            logMenuAction("exit.click")
            console.log("Exit")
          }
        }
      ]
    },
  ]

  return (
    <Menubar data-testid="app-menubar">
      {template.map((menu) => (
        <MenubarMenu key={menu.label}>
          <MenubarTrigger data-testid={`menu-trigger-${menu.label.toLowerCase()}`}>{menu.label}</MenubarTrigger>
          <MenubarContent data-testid={`menu-content-${menu.label.toLowerCase()}`}>
            {menu.submenu.map((item, index) => renderMenuItem(item, index, menu.label))}
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  )
}
  