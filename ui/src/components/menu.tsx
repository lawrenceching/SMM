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
import { useDialogs } from "@/components/dialog-provider"
import type { FolderType, FileItem } from "@/components/dialog-provider"

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

function renderMenuItem(item: MenuContentItem, index: number): React.ReactNode {
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
  return (
    <MenubarItem
      key={`item-${index}`}
      disabled={menuItem.disabled}
      inset={menuItem.inset}
      variant={menuItem.variant}
      onClick={menuItem.onClick}
    >
      {menuItem.icon && <span className="mr-2">{menuItem.icon}</span>}
      {menuItem.name}
      {menuItem.shortcut && <MenubarShortcut>{menuItem.shortcut}</MenubarShortcut>}
    </MenubarItem>
  )
}

// Check if running in Electron environment
function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined'
}

// Open native file dialog in Electron
async function openNativeFileDialog(): Promise<FileItem | null> {
  if (!isElectron()) {
    return null
  }

  try {
    // Check if electron.dialog is available
    const electron = (window as any).electron
    if (electron?.dialog?.showOpenDialog) {
      const result = await electron.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Folder'
      })
      
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        const path = result.filePaths[0]
        const name = path.split(/[/\\]/).pop() || path
        return {
          name,
          path,
          isDirectory: true
        }
      }
    }
  } catch (error) {
    console.error('Failed to open native file dialog:', error)
  }
  
  return null
}

export function Menu() {
  const { openFolderDialog, filePickerDialog, downloadVideoDialog } = useDialogs()
  const [openOpenFolder] = openFolderDialog
  const [openFilePicker] = filePickerDialog
  const [openDownloadVideo] = downloadVideoDialog

  const handleOpenFolder = () => {
    // Check if in Electron environment
    if (isElectron()) {
      // Use OpenFolderDialog to select folder type
      openOpenFolder((type: FolderType) => {
        console.log(`Selected folder type: ${type}`)
        // TODO: Handle folder selection based on type
        // After type selection, you can open native file dialog if needed
        openNativeFileDialog().then((selectedFile) => {
          if (selectedFile) {
            console.log(`Selected folder: ${selectedFile.path}`)
            // TODO: Handle folder selection based on type
          }
        })
      })
    } else {
      // Use FilePickerDialog for browser
      openFilePicker((file: FileItem) => {
        console.log(`Selected folder: ${file.path}`)
        // TODO: Handle folder selection
      }, {
        title: "Select Folder",
        description: "Choose a folder to open"
      })
    }
  }

  const template: MenuTemplate[] = [
    {
      label: 'SMM',
      submenu: [
        {
          name: "Open Folder",
          onClick: handleOpenFolder
        },
        {
          name: "Download Video",
          onClick: () => {
            openDownloadVideo((url: string, downloadFolder: string) => {
              console.log(`Downloading video from ${url} to ${downloadFolder}`)
              // TODO: Implement video download logic
            })
          }
        },
        {
          type: "separator"
        },
        {
          name: "Exit",
          onClick: () => {
            console.log("Exit")
          }
        }
      ]
    },
  ]

  return (
    <Menubar>
      {template.map((menu) => (
        <MenubarMenu key={menu.label}>
          <MenubarTrigger>{menu.label}</MenubarTrigger>
          <MenubarContent>
            {menu.submenu.map((item, index) => renderMenuItem(item, index))}
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  )
}
  