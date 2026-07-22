/// <reference types="@wdio/globals/types" />

import { browser } from '@wdio/globals'

export type E2eFolderSnapshot = { path: string; status: string }

/** Must match TvShowPanelHeader isUpdatingTvShow busy statuses. */
const BUSY_STATUSES = new Set([
  'idle',
  'pending_for_initialization',
  'initializing',
  'loading',
  'updating',
])

export function isBusyFolderStatus(status: string | null | undefined): boolean {
  if (status == null || status === '') return true
  return BUSY_STATUSES.has(status)
}

export async function getSelectedFolderSnapshot(): Promise<E2eFolderSnapshot | null> {
  return browser.execute((): E2eFolderSnapshot | null => {
    const bridge = (
      window as Window & {
        __uiMediaFolderStore?: {
          getSelectedFolderSnapshot?: () => { path: string; status: string } | null
        }
      }
    ).__uiMediaFolderStore
    if (!bridge?.getSelectedFolderSnapshot) return null
    return bridge.getSelectedFolderSnapshot()
  })
}

export function formatImmersiveInputTimeoutMsg(
  timeoutMs: number,
  snapshot: E2eFolderSnapshot | null,
): string {
  if (snapshot && isBusyFolderStatus(snapshot.status)) {
    return (
      `Folder was still ${snapshot.status} after ${timeoutMs}ms ` +
      `(immersive-input hidden until status=ok; path=${snapshot.path})`
    )
  }
  if (snapshot) {
    return (
      `immersive-input was not displayed after ${timeoutMs}ms ` +
      `(folder status=${snapshot.status}; path=${snapshot.path})`
    )
  }
  return (
    `immersive-input was not displayed after ${timeoutMs}ms ` +
    `(could not read folder status from window.__uiMediaFolderStore)`
  )
}

export async function waitUntilSelectedFolderReady(
  timeoutMs: number = 3 * 60 * 1000,
): Promise<void> {
  try {
    await browser.waitUntil(
      async () => {
        const snapshot = await getSelectedFolderSnapshot()
        return snapshot != null && !isBusyFolderStatus(snapshot.status)
      },
      {
        timeout: timeoutMs,
        interval: 250,
        timeoutMsg:
          `Selected folder did not become ready after ${timeoutMs}ms ` +
          `(could not read folder status from window.__uiMediaFolderStore or folder was still busy)`,
      },
    )
  } catch {
    const snapshot = await getSelectedFolderSnapshot().catch(() => null)
    if (snapshot && isBusyFolderStatus(snapshot.status)) {
      throw new Error(
        `Folder was still ${snapshot.status} after ${timeoutMs}ms ` +
          `(path=${snapshot.path})`,
      )
    }
    if (snapshot) {
      throw new Error(
        `Selected folder did not become ready after ${timeoutMs}ms ` +
          `(status=${snapshot.status}; path=${snapshot.path})`,
      )
    }
    throw new Error(
      `Could not read selected folder snapshot from window.__uiMediaFolderStore after ${timeoutMs}ms ` +
        `(bridge missing or getSelectedFolderSnapshot returned null)`,
    )
  }
}
