import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { ConfigPanel } from "@/components/ui/config-panel"
import type { ConfigDialogProps } from "./types"

export function ConfigDialog({ isOpen, onClose, initialTab }: ConfigDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="p-0 flex flex-col"
        style={{
          maxWidth: '90vw',
          width: '100%',
          height: '90vh'
        }}
        showCloseButton={true}
        data-testid="config-dialog"
      >
        <ConfigPanel initialTab={initialTab} />
      </DialogContent>
    </Dialog>
  )
}

