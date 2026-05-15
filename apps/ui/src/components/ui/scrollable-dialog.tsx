import * as React from "react"

import { DialogContent, DialogHeader } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

function ScrollableDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      data-slot="scrollable-dialog-content"
      className={cn("flex min-h-0 flex-col gap-4 overflow-hidden", className)}
      {...props}
    />
  )
}

function ScrollableDialogHeader({ className, ...props }: React.ComponentProps<typeof DialogHeader>) {
  return <DialogHeader data-slot="scrollable-dialog-header" className={cn("shrink-0 pr-8 text-left", className)} {...props} />
}

function ScrollableDialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scrollable-dialog-body"
      className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1", className)}
      {...props}
    />
  )
}

function ScrollableDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scrollable-dialog-footer"
      className={cn("flex shrink-0 justify-end gap-2 border-t pt-4", className)}
      {...props}
    />
  )
}

export { ScrollableDialogContent, ScrollableDialogHeader, ScrollableDialogBody, ScrollableDialogFooter }
