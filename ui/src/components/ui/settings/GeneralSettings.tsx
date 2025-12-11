import { useConfig } from "@/components/config-provider"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

export function GeneralSettings() {
  const { userConfig } = useConfig()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">General Settings</h2>
        <p className="text-muted-foreground mb-6">
          Configure general application settings
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="language">Application Language</Label>
          <Select defaultValue={userConfig.applicationLanguage}>
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
            defaultValue={userConfig.tmdb?.host || ''}
            placeholder="https://api.themoviedb.org/3"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmdb-api-key">TMDB API Key</Label>
          <Input
            id="tmdb-api-key"
            type="password"
            defaultValue={userConfig.tmdb?.apiKey || ''}
            placeholder="Enter your TMDB API key"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tmdb-proxy">HTTP Proxy</Label>
          <Input
            id="tmdb-proxy"
            defaultValue={userConfig.tmdb?.httpProxy || ''}
            placeholder="http://proxy.example.com:8080"
          />
        </div>
      </div>
    </div>
  )
}

