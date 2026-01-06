import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useConfig } from "@/components/config-provider"
import { SUPPORTED_LANGUAGES, changeLanguage, type SupportedLanguage } from "@/lib/i18n"
import { useTranslation } from "@/lib/i18n"

export function LanguageSwitcher() {
  const { userConfig, setUserConfig } = useConfig()
  const { i18n } = useTranslation()
  const currentLanguage = (userConfig.applicationLanguage || i18n.language) as SupportedLanguage

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    await changeLanguage(lang)
    // Update user config
    setUserConfig({
      ...userConfig,
      applicationLanguage: lang,
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <span className="mr-2">🌐</span>
          {SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage)?.name || currentLanguage}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className="flex items-center justify-between"
          >
            <span>{lang.name}</span>
            {currentLanguage === lang.code && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

