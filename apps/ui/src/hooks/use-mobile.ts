import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_LAYOUT_STORAGE_KEY = "features.isMobileLayoutEnabled"

function isMobileLayoutEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(MOBILE_LAYOUT_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Respect the mobile layout feature flag; never report mobile when disabled.
    if (!isMobileLayoutEnabled()) {
      setIsMobile(false)
      return
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
