import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from "@/components/ui/scrollable-dialog"
import { Button } from "@/components/ui/button"
import type { UIScrapeDialogProps } from "./types"
import { useTranslation } from "@/lib/i18n"
import { UIScrapeDialogTable } from "./UIScrapeDialogTable"

export function UIScrapeDialog({
  isOpen,
  onClose,
  tasks,
  allTasksDone,
  showButtons,
  cancelDisabled,
  canDismissIncidentally,
  onCancel,
  onStart,
}: UIScrapeDialogProps) {
  const { t } = useTranslation("dialogs")
  const { t: tCommon } = useTranslation("common")

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && canDismissIncidentally) {
          onClose()
        }
      }}
    >
      <ScrollableDialogContent
        showCloseButton={canDismissIncidentally}
        className="max-w-2xl"
        data-testid="scrape-dialog"
      >
        <ScrollableDialogHeader>
          <DialogTitle>{t("scrape.defaultTitle")}</DialogTitle>
          <DialogDescription>{t("scrape.defaultDescription")}</DialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody>
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              {t("scrape.noTasks")}
            </div>
          ) : (
            <UIScrapeDialogTable tasks={tasks} />
          )}
        </ScrollableDialogBody>
        {showButtons && (
          <ScrollableDialogFooter>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={cancelDisabled}
              data-testid="scrape-dialog-cancel"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={onStart}
              disabled={allTasksDone || cancelDisabled}
              data-testid="scrape-dialog-start"
            >
              {allTasksDone ? t("scrape.done") : t("scrape.start")}
            </Button>
          </ScrollableDialogFooter>
        )}
      </ScrollableDialogContent>
    </Dialog>
  )
}
