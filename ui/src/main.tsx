import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppV2 from './AppV2.tsx'
import AppNavigation from './AppNavigation.tsx'
import { ThemeProvider } from './components/theme-provider'
import { ConfigProvider } from './components/config-provider'
import { MediaMetadataProvider } from './components/media-metadata-provider'
import { DialogProvider } from './components/dialog-provider'

// Hook to detect mobile screen
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    // Initial check using window width
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
  })

  useEffect(() => {
    // Check window width
    const checkWidth = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Check media query
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }

    // Initial check
    checkWidth()

    // Listen to window resize
    window.addEventListener('resize', checkWidth)

    // Listen to media query changes (for better accuracy)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleMediaChange)
    }

    return () => {
      window.removeEventListener('resize', checkWidth)
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange)
      } else {
        mediaQuery.removeListener(handleMediaChange)
      }
    }
  }, [])

  return isMobile
}

function AppSwitcher() {
  const [useAppV2, setUseAppV2] = useState(true)
  const isMobile = useIsMobile()

  // On mobile, always use AppNavigation
  if (isMobile) {
    return <AppNavigation />
  }

  // On desktop, show App/AppV2 switcher
  return (
    <>
      {/* 切换按钮 */}
      <button
        onClick={() => setUseAppV2(!useAppV2)}
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          zIndex: 9999,
          padding: '8px 16px',
          backgroundColor: '#4a9eff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '500',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#3a8eef'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#4a9eff'
        }}
      >
        {useAppV2 ? '切换到 App' : '切换到 AppV2'}
      </button>

      {/* 渲染对应的组件 */}
      {useAppV2 ? <AppV2 /> : <App />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ConfigProvider>
        <MediaMetadataProvider>
          <DialogProvider>
            <AppSwitcher />
          </DialogProvider>
        </MediaMetadataProvider>
      </ConfigProvider>
    </ThemeProvider>
  </StrictMode>,
)
