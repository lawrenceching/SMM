import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Send } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

export function Feedback() {
  const { t } = useTranslation('settings')
  
  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">{t('feedback.title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('feedback.description')}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="feedback-type">{t('feedback.type')}</Label>
          <select
            id="feedback-type"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="bug">{t('feedback.typeBug')}</option>
            <option value="feature">{t('feedback.typeFeature')}</option>
            <option value="improvement">{t('feedback.typeImprovement')}</option>
            <option value="other">{t('feedback.typeOther')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="feedback-message">{t('feedback.message')}</Label>
          <Textarea
            id="feedback-message"
            placeholder={t('feedback.messagePlaceholder')}
            className="min-h-[200px]"
          />
        </div>

        <div className="flex justify-end">
          <Button>
            <Send className="mr-2 h-4 w-4" />
            {t('feedback.send')}
          </Button>
        </div>
      </div>
    </div>
  )
}

