import { useState, useEffect, useMemo } from "react"
import { useConfig } from "@/components/config-provider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function GeneralSettings() {
  const { userConfig, setUserConfig } = useConfig()
  
  // Track initial values
  const initialValues = useMemo(() => ({
    applicationLanguage: userConfig.applicationLanguage || 'zh-CN',
    tmdbHost: userConfig.tmdb?.host || '',
    tmdbApiKey: userConfig.tmdb?.apiKey || '',
    tmdbProxy: userConfig.tmdb?.httpProxy || '',
  }), [userConfig])

  // Track current form values
  const [applicationLanguage, setApplicationLanguage] = useState(initialValues.applicationLanguage)
  const [tmdbHost, setTmdbHost] = useState(initialValues.tmdbHost)
  const [tmdbApiKey, setTmdbApiKey] = useState(initialValues.tmdbApiKey)
  const [tmdbProxy, setTmdbProxy] = useState(initialValues.tmdbProxy)

  // Reset form when userConfig changes
  useEffect(() => {
    setApplicationLanguage(initialValues.applicationLanguage)
    setTmdbHost(initialValues.tmdbHost)
    setTmdbApiKey(initialValues.tmdbApiKey)
    setTmdbProxy(initialValues.tmdbProxy)
  }, [initialValues])

  // Detect changes
  const hasChanges = useMemo(() => {
    return (
      applicationLanguage !== initialValues.applicationLanguage ||
      tmdbHost !== initialValues.tmdbHost ||
      tmdbApiKey !== initialValues.tmdbApiKey ||
      tmdbProxy !== initialValues.tmdbProxy
    )
  }, [applicationLanguage, tmdbHost, tmdbApiKey, tmdbProxy, initialValues])

  // Handle save
  const handleSave = () => {
    const updatedConfig = {
      ...userConfig,
      applicationLanguage: applicationLanguage as 'zh-CN' | 'en-US',
      tmdb: {
        ...userConfig.tmdb,
        host: tmdbHost || undefined,
        apiKey: tmdbApiKey || undefined,
        httpProxy: tmdbProxy || undefined,
      },
    }
    setUserConfig(updatedConfig)
  }

  return (
    <div className="space-y-6 p-6 relative">
      <div>
        <h2 className="text-2xl font-semibold mb-4">General Settings</h2>
        <p className="text-muted-foreground mb-6">
          Configure general application settings
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="language">Application Language</Label>
          <Select value={applicationLanguage} onValueChange={setApplicationLanguage}>
            <SelectTrigger id="language">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-CN">中文 (简体)</SelectItem>
              <SelectItem value="en-US">English</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmdb-host">TMDB Host</Label>
          <Input
            id="tmdb-host"
            value={tmdbHost}
            onChange={(e) => setTmdbHost(e.target.value)}
            placeholder="https://api.themoviedb.org/3"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmdb-api-key">TMDB API Key</Label>
          <Input
            id="tmdb-api-key"
            type="password"
            value={tmdbApiKey}
            onChange={(e) => setTmdbApiKey(e.target.value)}
            placeholder="Enter your TMDB API key"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmdb-proxy">HTTP Proxy</Label>
          <Input
            id="tmdb-proxy"
            value={tmdbProxy}
            onChange={(e) => setTmdbProxy(e.target.value)}
            placeholder="http://proxy.example.com:8080"
          />
        </div>
      </div>

      {hasChanges && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      )}
    </div>
  )
}

