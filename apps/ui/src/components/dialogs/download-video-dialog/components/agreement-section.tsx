import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export interface AgreementSectionProps {
  hasAgreed: boolean
  isAgreementChecked: boolean
  onAgreementChange: (checked: boolean) => void
  t: (key: string) => string
}

export function AgreementSection({
  hasAgreed,
  isAgreementChecked,
  onAgreementChange,
  t,
}: AgreementSectionProps) {
  if (hasAgreed) return null

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
      <p className="font-medium">{t("downloadVideo.agreementTitle")}</p>
      <p className="text-muted-foreground">{t("downloadVideo.agreementDescription")}</p>
      <div className="mt-1 flex items-center gap-2">
        <Checkbox
          id="download-video-agreement"
          data-testid="download-video-dialog-agreement-checkbox"
          checked={isAgreementChecked}
          onCheckedChange={(checked) => onAgreementChange(checked === true)}
        />
        <Label htmlFor="download-video-agreement" className="cursor-pointer font-normal">
          {t("downloadVideo.agreementCheckboxLabel")}
        </Label>
      </div>
      {!isAgreementChecked && (
        <p className="text-xs text-destructive">
          {t("downloadVideo.agreementRequiredNotice")}
        </p>
      )}
    </div>
  )
}
