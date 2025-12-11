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
import { LogOutIcon } from "lucide-react"

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

const template: MenuTemplate[] = [
  {
    label: 'SMM',
    submenu: [
      {
        name: "Open Folder",
        onClick: () => {
          console.log("Open TvShow/Anime Folder")
        }
      },
      {
        name: "Download Video",
        onClick: () => {
          console.log("Download Video")
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

export function Menu() {
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
  