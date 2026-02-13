import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import type { SpinnerDialogProps } from "./types"

export function SpinnerDialog({ isOpen, message }: SpinnerDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="flex flex-col items-center justify-center gap-4 p-8"
        showCloseButton={false}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </DialogContent>
    </Dialog>
  )
}

