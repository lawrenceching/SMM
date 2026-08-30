import { Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import type { PrimaryDatabase } from "@smm/types"
import type { MediaDatabasesSettingsProps } from "./useMediaDatabaseSettings"
import { useMediaDatabaseSettings } from "./useMediaDatabaseSettings"

const PRIMARY_DATABASE_OPTIONS: {
  value: PrimaryDatabase
  labelKey: 'mediaDatabases.primaryDatabaseTmdb' | 'mediaDatabases.primaryDatabaseTvdb'
}[] = [
  { value: 'TMDB', labelKey: 'mediaDatabases.primaryDatabaseTmdb' },
  { value: 'TVDB', labelKey: 'mediaDatabases.primaryDatabaseTvdb' },
]

export function MediaDatabasesSettings() {
  const props = useMediaDatabaseSettings()
  return <MediaDatabasesSettingsView {...props} />
}

export function MediaDatabasesSettingsView({
  form,
  errors,
  hasUrlErrors,
  isLoading,
  isSaving,
  hasChanges,
  saveError,
  onSave,
  onReset,
}: MediaDatabasesSettingsProps) {
  const { t } = useTranslation(['settings', 'common', 'validation'])

  return (
    <div className="space-y-6 p-6 relative" data-testid="media-databases-settings">
      <div>
        <h2 className="text-2xl font-semibold mb-4">{t('mediaDatabases.title')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('mediaDatabases.description')}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="primary-database">{t('mediaDatabases.primaryDatabase')}</Label>
          <Select
            value={form.primaryDatabase}
            onValueChange={(v) => form.setPrimaryDatabase(v as PrimaryDatabase)}
            disabled={isLoading}
          >
            <SelectTrigger id="primary-database" data-testid="setting-primary-database-trigger">
              <SelectValue placeholder={t('mediaDatabases.primaryDatabaseDescription')} />
            </SelectTrigger>
            <SelectContent data-testid="setting-primary-database-content">
              {PRIMARY_DATABASE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} data-testid={`setting-primary-database-option-${opt.value}`}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t('mediaDatabases.primaryDatabaseDescription')}</p>
        </div>

        {/* TMDB Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-medium">{t('mediaDatabases.tmdbSection')}</h3>

          <div className="space-y-2">
            <Label htmlFor="tmdb-host">{t('mediaDatabases.tmdbHost')}</Label>
            <Input
              id="tmdb-host"
              value={form.tmdbHost}
              onChange={(e) => form.setTmdbHost(e.target.value)}
              placeholder={t('mediaDatabases.tmdbHostPlaceholder')}
              disabled={isLoading}
              aria-invalid={!!errors.tmdbHost || undefined}
              data-testid="setting-tmdb-host"
            />
            {errors.tmdbHost && (
              <p className="text-sm text-destructive" data-testid="setting-tmdb-host-error">
                {t(errors.tmdbHost, { ns: 'validation' })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tmdb-api-key">{t('mediaDatabases.tmdbApiKey')}</Label>
            <Input
              id="tmdb-api-key"
              type="password"
              value={form.tmdbApiKey}
              onChange={(e) => form.setTmdbApiKey(e.target.value)}
              placeholder={t('mediaDatabases.tmdbApiKeyPlaceholder')}
              disabled={isLoading}
              data-testid="setting-tmdb-api-key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tmdb-proxy">{t('mediaDatabases.tmdbHttpProxy')}</Label>
            <Input
              id="tmdb-proxy"
              value={form.tmdbProxy}
              onChange={(e) => form.setTmdbProxy(e.target.value)}
              placeholder={t('mediaDatabases.httpProxyPlaceholder')}
              disabled={isLoading}
              aria-invalid={!!errors.tmdbProxy || undefined}
              data-testid="setting-tmdb-proxy"
            />
            {errors.tmdbProxy && (
              <p className="text-sm text-destructive" data-testid="setting-tmdb-proxy-error">
                {t(errors.tmdbProxy, { ns: 'validation' })}
              </p>
            )}
          </div>
        </div>

        {/* TVDB Section */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-medium">{t('mediaDatabases.tvdbSection')}</h3>

          <div className="space-y-2">
            <Label htmlFor="tvdb-host">{t('mediaDatabases.tvdbHost')}</Label>
            <Input
              id="tvdb-host"
              value={form.tvdbHost}
              onChange={(e) => form.setTvdbHost(e.target.value)}
              placeholder={t('mediaDatabases.tvdbHostPlaceholder')}
              disabled={isLoading}
              aria-invalid={!!errors.tvdbHost || undefined}
              data-testid="setting-tvdb-host"
            />
            {errors.tvdbHost && (
              <p className="text-sm text-destructive" data-testid="setting-tvdb-host-error">
                {t(errors.tvdbHost, { ns: 'validation' })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tvdb-api-key">{t('mediaDatabases.tvdbApiKey')}</Label>
            <Input
              id="tvdb-api-key"
              type="password"
              value={form.tvdbApiKey}
              onChange={(e) => form.setTvdbApiKey(e.target.value)}
              placeholder={t('mediaDatabases.tvdbApiKeyPlaceholder')}
              disabled={isLoading}
              data-testid="setting-tvdb-api-key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tvdb-proxy">{t('mediaDatabases.tvdbHttpProxy')}</Label>
            <Input
              id="tvdb-proxy"
              value={form.tvdbProxy}
              onChange={(e) => form.setTvdbProxy(e.target.value)}
              placeholder={t('mediaDatabases.httpProxyPlaceholder')}
              disabled={isLoading}
              aria-invalid={!!errors.tvdbProxy || undefined}
              data-testid="setting-tvdb-proxy"
            />
            {errors.tvdbProxy && (
              <p className="text-sm text-destructive" data-testid="setting-tvdb-proxy-error">
                {t(errors.tvdbProxy, { ns: 'validation' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {saveError && (
        <div className="text-sm text-destructive mt-2" data-testid="setting-save-error">
          {saveError.message}
        </div>
      )}

      {hasChanges && !isLoading && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
          <Button variant="outline" onClick={onReset} disabled={isSaving} data-testid="settings-reset-button">
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button onClick={onSave} disabled={isSaving || hasUrlErrors} data-testid="settings-save-button">
            <span className="inline-flex items-center gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save', { ns: 'common' })}
            </span>
          </Button>
        </div>
      )}
    </div>
  )
}
