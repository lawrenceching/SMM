import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n' // Initialize i18n
import AppV2 from './AppV2.tsx'
import AppNavigation from './AppNavigation.tsx'
import { ThemeProvider } from './providers/theme-provider'
import { ConfigProvider } from './providers/config-provider'
import { MediaMetadataProvider, useMediaMetadata } from './providers/media-metadata-provider'
import { DialogProvider, useDialogs } from './providers/dialog-provider'
import { useWebSocket, useWebSocketEvent, sendAcknowledgement } from './hooks/useWebSocket'
import { Button } from './components/ui/button'
import { AppInitializer } from './AppInitializer'
import { SocketIoUserConfigFolderRenamedEventListener } from './components/eventlisteners/SocketIoUserConfigFolderRenamedEventListener.tsx'
import { PingEventListener } from './components/eventlisteners/PingEventListener.tsx'
import { MediaFolderImportedEventHandler } from './components/eventlisteners/MediaFolderImportedEventHandler.tsx'
import { FixedDelayBackgroundJobHandler } from './components/eventlisteners/FixedDelayBackgroundJobHandler.tsx'
import { RenameFilesPlanReadyEventListener } from './components/eventlisteners/RenameFilesPlanReadyEventListener.tsx'
import { UserConfigUpdatedEventListener } from './components/eventlisteners/UserConfigUpdatedEventListener.tsx'
import { MediaMetadataUpdatedEventListener } from './components/eventlisteners/MediaMetadataUpdatedEventListener.tsx'
import { BackgroundJobsProvider } from './components/background-jobs/BackgroundJobsProvider.tsx'
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
  const { selectedMediaMetadata } = useMediaMetadata();
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
    }

    document.dispatchEvent(new CustomEvent('socket.io_' + message.event, {
      detail: message.data,
    }));
    console.log(`Dispatched event: socket.io_${message.event}`)
  });

  return (
    <></>
  )
}

function EventListeners() {
  return (
    <>
      <SocketIoUserConfigFolderRenamedEventListener />
      <PingEventListener />
      <RenameFilesPlanReadyEventListener />
      <UserConfigUpdatedEventListener />
      <MediaMetadataUpdatedEventListener />
      <MediaFolderImportedEventHandler />
      <FixedDelayBackgroundJobHandler />
    </>
  )
}

function AppSwitcher() {
  // Establish WebSocket connection at the switcher level so it persists across view changes
  useWebSocket();

  const isMobile = useIsMobile()

  // On mobile, use AppNavigation
  if (isMobile) {
    return (
      <>
        <AppNavigation />
        <WebSocketHandlers />
        <EventListeners />
      </>
    )
  }

  // On desktop, use AppV2 only
  return (
    <>
      <AppV2 />
      <WebSocketHandlers />
      <EventListeners />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ConfigProvider>
        <MediaMetadataProvider>
          <DialogProvider>
            <BackgroundJobsProvider>
              <AppInitializer />
              <AppSwitcher />
            </BackgroundJobsProvider>
          </DialogProvider>
        </MediaMetadataProvider>
      </ConfigProvider>
    </ThemeProvider>
  </StrictMode>,
)
