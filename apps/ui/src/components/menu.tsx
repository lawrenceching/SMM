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
import { cleanUp } from "@/api/cleanUp"
import { toast } from "sonner"
import { hello } from "@/api/hello"
import { openInFileManagerApi } from "@/api/openInFileManager"
import { Path } from "@core/path"

export interface MenuItem {
  name: string
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
          {submenu.items.map((subItem, subIndex) => renderMenuItem(subItem, subIndex))}
        </MenubarSubContent>
      </MenubarSub>
    )
  }

  // Regular menu item
  const menuItem = item as MenuItem
  // Generate test ID from menu label and item name (e.g., "menu-smm-config")
  const testId = menuLabel && menuItem.name
    ? `menu-${menuLabel.toLowerCase()}-${menuItem.name.toLowerCase().replace(/\s+/g, '-')}`
    : undefined

  return (
    <MenubarItem
      key={`item-${index}`}
      disabled={menuItem.disabled}
      inset={menuItem.inset}
      variant={menuItem.variant}
      onClick={menuItem.onClick}
      data-testid={testId}
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
  const { configDialog } = useDialogs()
  const { t } = useTranslation('components')

  // const [openDownloadVideo] = downloadVideoDialog
  const [openConfig] = configDialog

  const template: MenuTemplate[] = [
    {
      label: 'SMM',
      submenu: [
        {
          name: t('menu.openFolder'),
          onClick: () => { onOpenFolderMenuClick?.() }
        },
        {
          name: t('menu.openMediaLibrary'),
          onClick: () => { onOpenMediaLibraryMenuClick?.() }
        },
        {
          name: t('menu.openAppDataFolder'),
          onClick: async () => {
            try {
              const result = await hello()
              if (result.error) {
                toast.error(result.error)
                return
              }
              // Convert platform path to POSIX format
              const posixPath = Path.isWindows() ? Path.posix(result.appDataDir) : result.appDataDir
              const openResult = await openInFileManagerApi(posixPath)
              if (openResult.error) {
                toast.error(openResult.error)
              }
            } catch (error) {
              toast.error(`Failed to open app data folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
          }
        },
        // {
        //   name: t('menu.downloadVideo'),
        //   onClick: () => {
        //     openDownloadVideo((url: string, downloadFolder: string) => {
        //       console.log(`Downloading video from ${url} to ${downloadFolder}`)
        //       // TODO: Implement video download logic
        //     })
        //   }
        // },
        {
          type: "separator"
        },
        {
          name: t('menu.config'),
          onClick: () => {
            openConfig()
          }
        },
        {
          name: t('menu.cleanUp'),
          onClick: async () => {
            try {
              const result = await cleanUp()
              if (result.success) {
                toast.success('Clean up completed successfully')
              } else {
                toast.error(result.error || 'Clean up failed')
              }
            } catch (error) {
              toast.error(`Failed to clean up: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
          }
        },
        {
          type: "separator"
        },
        {
          name: t('menu.exit'),
          onClick: () => {
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
  