/**
 * Electron production startup shows an inline Loading splash (`data:text/html…`)
 * until the embedded CLI serves the real UI over http(s).
 */
export function isElectronAppUiReadyUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}
