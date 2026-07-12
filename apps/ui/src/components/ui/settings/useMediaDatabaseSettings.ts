import { useState, useEffect, useMemo, useCallback } from "react"
import { useConfig } from "@/hooks/userConfig"
import { useSaveUserConfigMutation } from "@/hooks/userConfig"
import { nextTraceId } from "@/lib/utils"
import type { PrimaryDatabase } from "@core/types"

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export interface MediaDatabasesSettingsForm {
  tmdbHost: string
  tmdbApiKey: string
  tmdbProxy: string
  tvdbHost: string
  tvdbApiKey: string
  tvdbProxy: string
  primaryDatabase: PrimaryDatabase
  setTmdbHost: (v: string) => void
  setTmdbApiKey: (v: string) => void
  setTmdbProxy: (v: string) => void
  setTvdbHost: (v: string) => void
  setTvdbApiKey: (v: string) => void
  setTvdbProxy: (v: string) => void
  setPrimaryDatabase: (v: PrimaryDatabase) => void
}

export interface MediaDatabasesSettingsFormErrors {
  tmdbHost?: string
  tmdbProxy?: string
  tvdbHost?: string
  tvdbProxy?: string
}

export interface MediaDatabasesSettingsProps {
  form: MediaDatabasesSettingsForm
  errors: MediaDatabasesSettingsFormErrors
  hasUrlErrors: boolean
  isLoading: boolean
  isSaving: boolean
  hasChanges: boolean
  saveError: Error | null
  onSave: () => void
  onReset: () => void
}

export function useMediaDatabaseSettings(): MediaDatabasesSettingsProps {
  const { userConfig, isLoading: isConfigLoading } = useConfig()

  const initialValues = useMemo(() => ({
    tmdbHost: userConfig.tmdb?.host || '',
    tmdbApiKey: userConfig.tmdb?.apiKey || '',
    tmdbProxy: userConfig.tmdb?.httpProxy || '',
    tvdbHost: userConfig.tvdb?.host || '',
    tvdbApiKey: userConfig.tvdb?.apiKey || '',
    tvdbProxy: userConfig.tvdb?.httpProxy || '',
    primaryDatabase: (userConfig.primaryDatabase || 'TMDB') as PrimaryDatabase,
  }), [userConfig])

  const [tmdbHost, setTmdbHost] = useState(initialValues.tmdbHost)
  const [tmdbApiKey, setTmdbApiKey] = useState(initialValues.tmdbApiKey)
  const [tmdbProxy, setTmdbProxy] = useState(initialValues.tmdbProxy)
  const [tvdbHost, setTvdbHost] = useState(initialValues.tvdbHost)
  const [tvdbApiKey, setTvdbApiKey] = useState(initialValues.tvdbApiKey)
  const [tvdbProxy, setTvdbProxy] = useState(initialValues.tvdbProxy)
  const [primaryDatabase, setPrimaryDatabase] = useState<PrimaryDatabase>(initialValues.primaryDatabase)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTmdbHost(initialValues.tmdbHost)
    setTmdbApiKey(initialValues.tmdbApiKey)
    setTmdbProxy(initialValues.tmdbProxy)
    setTvdbHost(initialValues.tvdbHost)
    setTvdbApiKey(initialValues.tvdbApiKey)
    setTvdbProxy(initialValues.tvdbProxy)
    setPrimaryDatabase(initialValues.primaryDatabase)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialValues])

  const hasChanges = useMemo(() => {
    return (
      tmdbHost !== initialValues.tmdbHost ||
      tmdbApiKey !== initialValues.tmdbApiKey ||
      tmdbProxy !== initialValues.tmdbProxy ||
      tvdbHost !== initialValues.tvdbHost ||
      tvdbApiKey !== initialValues.tvdbApiKey ||
      tvdbProxy !== initialValues.tvdbProxy ||
      primaryDatabase !== initialValues.primaryDatabase
    )
  }, [
    tmdbHost, tmdbApiKey, tmdbProxy,
    tvdbHost, tvdbApiKey, tvdbProxy,
    primaryDatabase, initialValues,
  ])

  const errors = useMemo(() => ({
    tmdbHost: tmdbHost && !isValidUrl(tmdbHost) ? 'invalidUrl' : undefined,
    tmdbProxy: tmdbProxy && !isValidUrl(tmdbProxy) ? 'invalidUrl' : undefined,
    tvdbHost: tvdbHost && !isValidUrl(tvdbHost) ? 'invalidUrl' : undefined,
    tvdbProxy: tvdbProxy && !isValidUrl(tvdbProxy) ? 'invalidUrl' : undefined,
  }), [tmdbHost, tmdbProxy, tvdbHost, tvdbProxy])

  const hasUrlErrors = Object.values(errors).some(Boolean)

  const saveMutation = useSaveUserConfigMutation()

  const onSave = useCallback(async () => {
    if (hasUrlErrors) return
    const traceId = `MediaDatabasesSettings-${nextTraceId()}`
    console.log(`[${traceId}] MediaDatabasesSettings: Saving media databases settings`)

    const updatedConfig = {
      ...userConfig,
      tmdb: {
        ...userConfig.tmdb,
        host: tmdbHost || undefined,
        apiKey: tmdbApiKey || undefined,
        httpProxy: tmdbProxy || undefined,
      },
      tvdb: {
        ...userConfig.tvdb,
        host: tvdbHost || undefined,
        apiKey: tvdbApiKey || undefined,
        httpProxy: tvdbProxy || undefined,
      },
      primaryDatabase,
    }
    await saveMutation.mutateAsync({ traceId, config: updatedConfig })
  }, [userConfig, tmdbHost, tmdbApiKey, tmdbProxy, tvdbHost, tvdbApiKey, tvdbProxy, primaryDatabase, saveMutation, hasUrlErrors])

  const onReset = useCallback(() => {
    setTmdbHost(initialValues.tmdbHost)
    setTmdbApiKey(initialValues.tmdbApiKey)
    setTmdbProxy(initialValues.tmdbProxy)
    setTvdbHost(initialValues.tvdbHost)
    setTvdbApiKey(initialValues.tvdbApiKey)
    setTvdbProxy(initialValues.tvdbProxy)
    setPrimaryDatabase(initialValues.primaryDatabase)
  }, [initialValues])

  return {
    form: {
      tmdbHost, setTmdbHost,
      tmdbApiKey, setTmdbApiKey,
      tmdbProxy, setTmdbProxy,
      tvdbHost, setTvdbHost,
      tvdbApiKey, setTvdbApiKey,
      tvdbProxy, setTvdbProxy,
      primaryDatabase, setPrimaryDatabase,
    },
    isLoading: isConfigLoading,
    isSaving: saveMutation.isPending,
    errors,
    hasUrlErrors,
    hasChanges,
    saveError: saveMutation.error ?? null,
    onSave,
    onReset,
  }
}
