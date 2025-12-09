import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import React from "react"
import type { ReactNode } from "react"

interface ThreeColumnLayoutProps {
  children: ReactNode
  className?: string
}

interface SlotProps {
  slot?: "left-sidebar-content" | "right-sidebar-content" | "sidebar-content"
  children?: ReactNode
}

export function ThreeColumnLayout({ children, className }: ThreeColumnLayoutProps) {
  // Filter children by slot prop
  const leftSidebarContent = getChildrenBySlot(children, "left-sidebar-content")
  const rightSidebarContent = getChildrenBySlot(children, "right-sidebar-content")
  const sidebarContent = getChildrenBySlot(children, "sidebar-content")

  return (
    <>
    <ResizablePanelGroup
          direction="horizontal"
          className={cn("border", className)}
        >
          <ResizablePanel defaultSize={20} minSize={20} maxSize={40}>
            {/* left sidebar */}
            <div className="flex flex-col h-full">
              {leftSidebarContent}
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={80}>
            <ResizablePanelGroup direction="horizontal">
              {/* sidebar content */}
              <ResizablePanel defaultSize={60}>
                {sidebarContent}
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={40} minSize={30} maxSize={40}>
                {/* right sidebar */}
                <div className="flex h-full items-center justify-center p-6">
                  {rightSidebarContent}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
        </>
  )
}

// Helper function to extract children by slot prop
function getChildrenBySlot(
  children: ReactNode,
  slot: "left-sidebar-content" | "right-sidebar-content" | "sidebar-content"
): ReactNode {
  const slotChildren = React.Children.toArray(children).filter((child) => {
    if (React.isValidElement<SlotProps>(child)) {
      // Check explicit slot prop first
      if (child.props.slot === slot) {
        return true
      }
      // Check if it's one of our slot wrapper components
      const childType = child.type as any
      if (
        (childType === LeftSidebarContent && slot === "left-sidebar-content") ||
        (childType === RightSidebarContent && slot === "right-sidebar-content") ||
        (childType === SidebarContent && slot === "sidebar-content")
      ) {
        return true
      }
    }
    return false
  })

  // Extract and return the children from the slot wrappers
  return slotChildren.map((child) => {
    if (React.isValidElement<SlotProps>(child)) {
      return child.props.children
    }
    return child
  })
}

// Slot wrapper components for better developer experience
export function LeftSidebarContent({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function RightSidebarContent({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export function SidebarContent({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

