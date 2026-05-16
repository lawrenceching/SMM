/** URL of the background-jobs service worker script (served from `public/`). */
export const DOWNLOAD_SERVICE_WORKER_URL = '/download-service-worker.js'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Ask the browser to fetch a newer `download-service-worker.js` (if any), recheck on
 * window focus, and run `onActivated` when a new worker takes control (`skipWaiting` in SW).
 */
export function attachDownloadServiceWorkerUpdateChecks(
  registration: ServiceWorkerRegistration,
  onActivated: () => void | Promise<void>,
): () => void {
  const runUpdateCheck = () => {
    void registration.update().catch(() => {})
  }

  runUpdateCheck()

  const onFocus = () => runUpdateCheck()
  window.addEventListener('focus', onFocus)

  const intervalId = window.setInterval(runUpdateCheck, UPDATE_CHECK_INTERVAL_MS)

  const onControllerChange = () => {
    void Promise.resolve(onActivated())
  }
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

  const onUpdateFound = () => {
    const installing = registration.installing
    if (!installing) return
    installing.addEventListener('statechange', () => {
      if (installing.state === 'activated') {
        void Promise.resolve(onActivated())
      }
    })
  }
  registration.addEventListener('updatefound', onUpdateFound)

  return () => {
    window.removeEventListener('focus', onFocus)
    window.clearInterval(intervalId)
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    registration.removeEventListener('updatefound', onUpdateFound)
  }
}
