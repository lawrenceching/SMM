import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ConfirmationDialogProps } from "./types"

export function ConfirmationDialog({ isOpen, config, onClose }: ConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={config?.className}
        showCloseButton={config?.showCloseButton}
      >
        {config?.title && (
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            {config.description && (
              <DialogDescription>{config.description}</DialogDescription>
            )}
          </DialogHeader>
        )}
        {config?.content}
      </DialogContent>
    </Dialog>
  )
}

