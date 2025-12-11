import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfigPanel } from "@/components/ui/config-panel"

interface DialogConfig {
  title?: string
  description?: string
  content?: ReactNode
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

interface ConfirmationDialogProps {
  isOpen: boolean
  config: DialogConfig | null
  onClose: () => void
}

function ConfirmationDialog({ isOpen, config, onClose }: ConfirmationDialogProps) {
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

interface SpinnerDialogProps {
  isOpen: boolean
  message?: string
}

function SpinnerDialog({ isOpen, message }: SpinnerDialogProps) {
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

interface ConfigDialogProps {
  isOpen: boolean
  onClose: () => void
}

function ConfigDialog({ isOpen, onClose }: ConfigDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[90vw] w-full h-[90vh] p-0"
        showCloseButton={true}
      >
        <ConfigPanel />
      </DialogContent>
    </Dialog>
  )
}

interface DialogContextValue {
  confirmationDialog: [
    openConfirmation: (config: DialogConfig) => void,
    closeConfirmation: () => void
  ]
  spinnerDialog: [
    openSpinner: (message?: string) => void,
    closeSpinner: () => void
  ]
  configDialog: [
    openConfig: () => void,
    closeConfig: () => void
  ]
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined)

interface DialogProviderProps {
  children: ReactNode
}

export function DialogProvider({ children }: DialogProviderProps) {
  // Confirmation dialog state
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [confirmationConfig, setConfirmationConfig] = useState<DialogConfig | null>(null)

  // Spinner dialog state
  const [isSpinnerOpen, setIsSpinnerOpen] = useState(false)
  const [spinnerMessage, setSpinnerMessage] = useState<string | undefined>(undefined)

  // Config dialog state
  const [isConfigOpen, setIsConfigOpen] = useState(false)

  const openConfirmation = useCallback((dialogConfig: DialogConfig) => {
    setConfirmationConfig(dialogConfig)
    setIsConfirmationOpen(true)
  }, [])

  const closeConfirmation = useCallback(() => {
    setIsConfirmationOpen(false)
    if (confirmationConfig?.onClose) {
      confirmationConfig.onClose()
    }
    // Clear config after a brief delay to allow animations to complete
    setTimeout(() => {
      setConfirmationConfig(null)
    }, 200)
  }, [confirmationConfig])

  const openSpinner = useCallback((message?: string) => {
    setSpinnerMessage(message)
    setIsSpinnerOpen(true)
  }, [])

  const closeSpinner = useCallback(() => {
    setIsSpinnerOpen(false)
    setTimeout(() => {
      setSpinnerMessage(undefined)
    }, 200)
  }, [])

  const openConfig = useCallback(() => {
    setIsConfigOpen(true)
  }, [])

  const closeConfig = useCallback(() => {
    setIsConfigOpen(false)
  }, [])

  const value: DialogContextValue = {
    confirmationDialog: [openConfirmation, closeConfirmation],
    spinnerDialog: [openSpinner, closeSpinner],
    configDialog: [openConfig, closeConfig],
  }

  return (
    <DialogContext.Provider value={value}>
      {children}
      <ConfirmationDialog
        isOpen={isConfirmationOpen}
        config={confirmationConfig}
        onClose={closeConfirmation}
      />
      <SpinnerDialog
        isOpen={isSpinnerOpen}
        message={spinnerMessage}
      />
      <ConfigDialog
        isOpen={isConfigOpen}
        onClose={closeConfig}
      />
    </DialogContext.Provider>
  )
}

export function useDialogs(): DialogContextValue {
  const context = useContext(DialogContext)
  if (context === undefined) {
    throw new Error("useDialogs must be used within a DialogProvider")
  }
  return context
}
