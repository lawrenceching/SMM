import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from '@/components/ui/scrollable-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n'
import { nextTraceId } from '@/lib/utils'
import {
  UI_FixedDelayBackgroundJobEvent,
  type FixedDelayBackgroundJobOutcome,
  type OnFixedDelayBackgroundJobEventData,
} from '@/types/eventTypes'
import type { AddTestBackgroundJobDialogProps } from './types'

const DURATION_OPTIONS = ['10', '30', '60', '120'] as const

export function AddTestBackgroundJobDialog({ isOpen, onClose }: AddTestBackgroundJobDialogProps) {
  const { t } = useTranslation(['dialogs', 'components', 'common'])
  const [durationSeconds, setDurationSeconds] = useState<string>('60')
  const [outcome, setOutcome] = useState<FixedDelayBackgroundJobOutcome>('succeeded')

  useEffect(() => {
    if (!isOpen) return
    setDurationSeconds('60')
    setOutcome('succeeded')
  }, [isOpen])

  const handleSubmit = useCallback(() => {
    const seconds = Number.parseInt(durationSeconds, 10)
    if (!Number.isFinite(seconds) || seconds <= 0) return

    const outcomeLabel =
      outcome === 'succeeded'
        ? t('addTestBackgroundJob.outcomeSucceeded')
        : t('addTestBackgroundJob.outcomeFailed')

    const detail: OnFixedDelayBackgroundJobEventData = {
      delay: seconds * 1000,
      name: t('addTestBackgroundJob.jobName', { seconds, outcome: outcomeLabel }),
      outcome,
      traceId: `AddTestBackgroundJobDialog:${nextTraceId()}`,
    }

    document.dispatchEvent(new CustomEvent(UI_FixedDelayBackgroundJobEvent, { detail }))
    onClose()
  }, [durationSeconds, outcome, onClose, t])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ScrollableDialogContent showCloseButton data-testid="add-test-background-job-dialog">
        <ScrollableDialogHeader>
          <DialogTitle>{t('addTestBackgroundJob.title')}</DialogTitle>
          <DialogDescription>{t('addTestBackgroundJob.description')}</DialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-job-duration">{t('addTestBackgroundJob.duration')}</Label>
            <Select value={durationSeconds} onValueChange={setDurationSeconds}>
              <SelectTrigger id="test-job-duration" data-testid="add-test-background-job-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t('addTestBackgroundJob.durationSeconds', { seconds: value })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-job-outcome">{t('addTestBackgroundJob.outcome')}</Label>
            <Select
              value={outcome}
              onValueChange={(value) => setOutcome(value as FixedDelayBackgroundJobOutcome)}
            >
              <SelectTrigger id="test-job-outcome" data-testid="add-test-background-job-outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="succeeded">{t('addTestBackgroundJob.outcomeSucceeded')}</SelectItem>
                <SelectItem value="failed">{t('addTestBackgroundJob.outcomeFailed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </ScrollableDialogBody>
        <ScrollableDialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            type="button"
            data-testid="add-test-background-job-submit"
            onClick={handleSubmit}
          >
            {t('addTestBackgroundJob.submit')}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
