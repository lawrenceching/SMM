import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n' // Initialize i18n
import App from './App.tsx'
import AppV2 from './AppV2.tsx'
import AppNavigation from './AppNavigation.tsx'
import { ThemeProvider } from './providers/theme-provider'
import { ConfigProvider, useConfig } from './providers/config-provider'
import { MediaMetadataProvider, useMediaMetadata } from './providers/media-metadata-provider'
import { DialogProvider, useDialogs } from './providers/dialog-provider'
import { GlobalStatesProvider, useGlobalStates } from './providers/global-states-provider'
import { RenameFilesPlanReady, USER_CONFIG_FOLDER_RENAMED_EVENT } from '@core/event-types'
import { useWebSocket, useWebSocketEvent, sendAcknowledgement } from './hooks/useWebSocket'
import { Button } from './components/ui/button'
import { AppInitializer } from './AppInitializer'
import { SocketIoUserConfigFolderRenamedEventListener } from './components/eventlisteners/SocketIoUserConfigFolderRenamedEventListener.tsx'
import { PingEventListener } from './components/eventlisteners/PingEventListener.tsx'

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

// WebSocketHandlers component - shared across all app views
function WebSocketHandlers() {
  const { reload: reloadUserConfig } = useConfig();
  const { refreshMediaMetadata, selectedMediaMetadata } = useMediaMetadata();
  const { fetchPendingPlans } = useGlobalStates();
  const { confirmationDialog } = useDialogs();
  const [openConfirmation, closeConfirmation] = confirmationDialog;

  useWebSocketEvent((message) => {
    // Handle getSelectedMediaMetadata event with Socket.IO acknowledgement
    if (message.event === "getSelectedMediaMetadata") {
      console.log('[WebSocketHandlers][DEBUG] getSelectedMediaMetadata received', {
        message,
        hasCallback: !!(message as any)._socketCallback,
        selectedMediaMetadata
      });
      
      // Send acknowledgement with selected media metadata
      sendAcknowledgement(message, {
        selectedMediaMetadata: selectedMediaMetadata || null,
      });
      console.log('[WebSocketHandlers][DEBUG] getSelectedMediaMetadata acknowledgement sent');
    }
    
    // Handle mediaMetadataUpdated event (no acknowledgement needed)
    if (message.event === "mediaMetadataUpdated") {
      const folderPath = message.data?.folderPath;
      if (folderPath) {
        console.log(`[WebSocketHandlers] Received mediaMetadataUpdated event for folder: ${folderPath}`);
        refreshMediaMetadata(folderPath);
      } else {
        console.warn(`[WebSocketHandlers] mediaMetadataUpdated event missing folderPath in data:`, message.data);
        reloadUserConfig();
      }
    }

    // Handle askForConfirmation event with Socket.IO acknowledgement
    if (message.event === "askForConfirmation") {
      console.log('[WebSocketHandlers][DEBUG] askForConfirmation received', {
        message,
        hasCallback: !!(message as any)._socketCallback,
        data: message.data
      });
      
      // Support both data formats:
      // 1. message field (from server tool)
      // 2. title and body fields (from debug API)
      const confirmationMessage = message.data?.body || message.data?.message;
      const dialogTitle = message.data?.title || "Confirmation";
      
      if (!confirmationMessage) {
        console.warn(`[WebSocketHandlers] askForConfirmation event missing message/body:`, message.data);
        // Send error acknowledgement
        sendAcknowledgement(message, { confirmed: false, error: 'Missing message' });
        return;
      }
      
      console.log(`[WebSocketHandlers] Received askForConfirmation event: ${confirmationMessage}`);
      
      // Handler to send acknowledgement and close dialog
      const sendResponse = (confirmed: boolean) => {
        console.log(`[WebSocketHandlers][DEBUG] sendResponse called with confirmed=${confirmed}`);
        
        // Send acknowledgement back via Socket.IO callback
        const ackData = {
          confirmed: confirmed,
          response: confirmed ? "yes" : "no",
        };
        console.log(`[WebSocketHandlers][DEBUG] About to call sendAcknowledgement with:`, ackData);
        sendAcknowledgement(message, ackData);
        console.log(`[WebSocketHandlers][DEBUG] sendAcknowledgement returned`);
        closeConfirmation();
      };
      
      // Open confirmation dialog with Yes/No buttons
      openConfirmation({
        title: dialogTitle,
        description: confirmationMessage,
        showCloseButton: false,
        onClose: () => {
          // If dialog is closed without clicking Yes/No, default to "no"
          sendResponse(false);
        },
        content: (
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => sendResponse(false)}
            >
              No
            </Button>
            <Button
              onClick={() => sendResponse(true)}
            >
              Yes
            </Button>
          </div>
        ),
      });
    } else if(message.event === "userConfigUpdated") {
      console.log('[WebSocketHandlers][DEBUG] userConfigUpdated received');
      reloadUserConfig();      
    }

    // Refetch pending rename plans when backend broadcasts that a new plan is ready
    if (message.event === RenameFilesPlanReady.event) {
      console.log('[WebSocketHandlers] Received renameFilesPlanReady, refetching pending plans');
      void fetchPendingPlans();
    }

    document.dispatchEvent(new CustomEvent('socket.io_' + USER_CONFIG_FOLDER_RENAMED_EVENT, {
      detail: message.data,
    }));
  });

  return (
    <></>
  )
}

function AppSwitcher() {
  // Establish WebSocket connection at the switcher level so it persists across view changes
  useWebSocket();
  
  const [useAppV2, setUseAppV2] = useState(true)
  const isMobile = useIsMobile()

  // On mobile, always use AppNavigation
  if (isMobile) {
    return (
      <>
        <AppNavigation />
        <WebSocketHandlers />
      </>
    )
  }

  // On desktop, show App/AppV2 switcher
  return (
    <>
      {/* 切换按钮 */}
      <button
        hidden
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
      <WebSocketHandlers />
      <SocketIoUserConfigFolderRenamedEventListener />
      <PingEventListener />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ConfigProvider>
        <MediaMetadataProvider>
          <GlobalStatesProvider>
            <DialogProvider>
              <AppInitializer />
              <AppSwitcher />
            </DialogProvider>
          </GlobalStatesProvider>
        </MediaMetadataProvider>
      </ConfigProvider>
    </ThemeProvider>
  </StrictMode>,
)
