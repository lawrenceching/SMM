import { useEffect, useMemo, useState } from "react"
import { useConfig } from "@/hooks/userConfig"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { nextTraceId } from "@/lib/utils"
import { AI_AGENT_PERMISSIONS } from "@smm/types"

export function AiAgentSettings() {
  const { userConfig, setAndSaveUserConfig } = useConfig()
  const { t } = useTranslation(['settings', 'common'])

  const initialValues = useMemo(
    () => ({
      metadataWrite:
        userConfig.aiAgent?.permissions?.includes(
          AI_AGENT_PERMISSIONS.metadataWrite,
        ) ?? false,
    }),
    [userConfig],
  )

  const [metadataWrite, setMetadataWrite] = useState(initialValues.metadataWrite)

  // Reset form when userConfig changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMetadataWrite(initialValues.metadataWrite)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialValues])

  const hasChanges = metadataWrite !== initialValues.metadataWrite

  const handleSave = async () => {
    const traceId = `AiAgentSettings-${nextTraceId()}`
    console.log(`[${traceId}] AiAgentSettings: Saving AI agent settings`)
    await setAndSaveUserConfig(traceId, {
      ...userConfig,
      aiAgent: {
        ...userConfig.aiAgent,
        permissions: metadataWrite ? [AI_AGENT_PERMISSIONS.metadataWrite] : [],
      },
    })
  }

  return (
    <div className="space-y-6 p-6 relative" data-testid="ai-agent-settings">
      <div>
        <h2 className="text-lg font-semibold">{t('aiAgent.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('aiAgent.description')}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            id="ai-agent-metadata-write"
            type="checkbox"
            checked={metadataWrite}
            onChange={(e) => setMetadataWrite(e.target.checked)}
            className="h-4 w-4 rounded border-input"
            data-testid="setting-ai-agent-metadata-write"
          />
          <Label htmlFor="ai-agent-metadata-write">{t('aiAgent.metadataWrite')}</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('aiAgent.metadataWriteDescription')}
        </p>
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button onClick={handleSave} data-testid="settings-save-button">
            {t('save', { ns: 'common' })}
          </Button>
        </div>
      )}
    </div>
  )
}
