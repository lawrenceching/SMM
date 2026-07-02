import { expect, browser } from '@wdio/globals'
import StatusBar from '../../componentobjects/StatusBar'
import { cleanup, setup } from 'test/lib/testbed'
import { delay } from 'es-toolkit'

/**
 * Diagnostic test for BackgroundJob `shows failure toast and remove` failure.
 *
 * Background: in CI, the deleteMenu.click() in that test fails with
 *   "element wasn't found" / stale-element reference after waitForExist passed.
 * Previous hypothesis (toast z-index overlapping the menu at bottom-right)
 * was rejected — gathering evidence before forming any new hypothesis.
 *
 * Each line is prefixed with [DIAGNOSE] for grep. Snapshots include:
 *  - computed bounding rect + z-index + pointer-events for toast, popover,
 *    ContextMenu, stop-all-menu, delete-menu, job-item
 *  - data-sonner-toast presence, [role=menu][data-state] for radix menu state
 *  - popover presence (does the popover itself close?)
 *  - document.elementsFromPoint(deleteMenu center) — what overlaps the menu
 *  - pointer / mouse / focus events captured in document capture phase
 *
 * Two runs for direct comparison:
 *  Run 1 — aborted path (NO sonner toast) — control baseline
 *  Run 2 — failed path (sonner toast visible) — reproduces the bug
 */
const TRACE = '[DIAGNOSE]'
const ts = () => new Date().toISOString()

function log(line: string): void {
  console.log(`${TRACE} ${ts()} ${line}`)
}

describe('Background Job — diagnostic evidence', () => {

  beforeEach(async () => {
    await setup({
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      removeDirInSidebar: true,
      openBrowserPage: true,
      resetUserConfig: true,
    })
  })

  afterEach(async () => {
    await cleanup({
      removeMetadataDir: true,
      removePlansDir: true,
      removeMediaFolders: true,
      removeDirInSidebar: true,
      resetUserConfig: true,
    })
  })

  it('Run1: aborted path (no toast) — control baseline', async function() {
    this.timeout(30_000)
    log('========== RUN 1 START: aborted path (no toast) ==========')

    const JOB_NAME = 'E2E 诊断任务-aborted'
    const DELAY_MS = 1500

    await browser.executeScript(`
      document.dispatchEvent(new CustomEvent('ui.fixedDelayBackgroundJob', {
        detail: { delay: ${DELAY_MS}, name: '${JOB_NAME}', traceId: 'e2eTest:DiagnoseAborted' }
      }))
    `, [])

    await delay(500)

    const jobId = await findJobIdByName(JOB_NAME)
    log(`found jobId=${jobId}`)
    expect(jobId).not.toBeNull()

    await StatusBar.abortBackgroundJob(jobId!)

    await browser.waitUntil(async () => {
      return (await StatusBar.backgroundJobStatusBadge(jobId!).getText()) === 'aborted'
    }, { timeout: 5000 })

    log('--- Run1: starting instrumentation ---')
    await installPointerListeners('run1')
    await snapshotDom('run1_BEFORE_RIGHT_CLICK', jobId!)

    const jobItem = $(`[data-testid="background-job-${jobId}"]`)
    log('Run1: dispatching right-click on job item')
    await jobItem.click({ button: 'right' })

    await snapshotDom('run1_AFTER_RIGHT_CLICK', jobId!)
    await dumpPointerEvents('run1_AFTER_RIGHT_CLICK')

    const deleteMenu = $(`[data-testid="background-job-${jobId}-delete-menu"]`)
    let waitErr: string | null = null
    try {
      await deleteMenu.waitForExist({ timeout: 3000 })
      log('Run1: deleteMenu.waitForExist passed')
    } catch (e: any) {
      waitErr = `waitForExist: ${e?.name ?? 'Error'}: ${e?.message ?? String(e)}`
      log(`Run1: deleteMenu.waitForExist FAILED — ${waitErr}`)
    }
    await snapshotDom('run1_AFTER_WAIT_EXIST', jobId!)

    log('Run1: attempting deleteMenu.click()')
    try {
      await deleteMenu.click()
      log('Run1: deleteMenu.click() SUCCEEDED')
    } catch (e: any) {
      log(`Run1: deleteMenu.click() FAILED — ${e?.name ?? 'Error'}: ${e?.message ?? String(e)}`)
    }
    await snapshotDom('run1_AFTER_CLICK', jobId!)
    await dumpPointerEvents('run1_AFTER_CLICK')
    log('========== RUN 1 END ==========')
  })

  it('Run2: failed path (toast visible) — reproduces the failure', async function() {
    this.timeout(30_000)
    log('========== RUN 2 START: failed path (toast visible) ==========')

    const JOB_NAME = 'E2E 诊断任务-failed'
    const DELAY_MS = 1000

    await browser.executeScript(`
      document.dispatchEvent(new CustomEvent('ui.fixedDelayBackgroundJob', {
        detail: { delay: ${DELAY_MS}, name: '${JOB_NAME}', outcome: 'failed', traceId: 'e2eTest:DiagnoseFailed' }
      }))
    `, [])

    await delay(500)

    const jobId = await findJobIdByName(JOB_NAME)
    log(`found jobId=${jobId}`)
    expect(jobId).not.toBeNull()

    await browser.waitUntil(async () => {
      return (await StatusBar.backgroundJobStatusBadge(jobId!).getText()) === 'failed'
    }, { timeout: DELAY_MS + 5000 })

    const toastEl = await $('[data-sonner-toast]')
    await toastEl.waitForExist({ timeout: 3000 })
    await browser.waitUntil(async () => {
      const text = await browser.execute(() => {
        return document.querySelector('[data-sonner-toast]')?.textContent?.trim() ?? ''
      })
      return text.length > 0 && text.includes(JOB_NAME)
    }, { timeout: 5000 })
    log('Run2: sonner toast visible')

    log('--- Run2: starting instrumentation ---')
    await installPointerListeners('run2')
    await snapshotDom('run2_BEFORE_RIGHT_CLICK', jobId!)

    const jobItem = $(`[data-testid="background-job-${jobId}"]`)
    log('Run2: dispatching right-click on job item')
    await jobItem.click({ button: 'right' })

    await snapshotDom('run2_AFTER_RIGHT_CLICK', jobId!)
    await dumpPointerEvents('run2_AFTER_RIGHT_CLICK')

    const deleteMenu = $(`[data-testid="background-job-${jobId}-delete-menu"]`)
    let waitErr: string | null = null
    try {
      await deleteMenu.waitForExist({ timeout: 3000 })
      log('Run2: deleteMenu.waitForExist passed')
    } catch (e: any) {
      waitErr = `waitForExist: ${e?.name ?? 'Error'}: ${e?.message ?? String(e)}`
      log(`Run2: deleteMenu.waitForExist FAILED — ${waitErr}`)
    }
    await snapshotDom('run2_AFTER_WAIT_EXIST', jobId!)

    log('Run2: attempting deleteMenu.click()')
    try {
      await deleteMenu.click()
      log('Run2: deleteMenu.click() SUCCEEDED')
    } catch (e: any) {
      log(`Run2: deleteMenu.click() FAILED — ${e?.name ?? 'Error'}: ${e?.message ?? String(e)}`)
    }
    await snapshotDom('run2_AFTER_CLICK', jobId!)
    await dumpPointerEvents('run2_AFTER_CLICK')

    const radixState = await browser.execute(() => {
      const popover = document.querySelector('[data-testid="background-jobs-list"]')
      const menus = Array.from(document.querySelectorAll('[role="menu"]')).map((el) => ({
        state: el.getAttribute('data-state'),
        testId: (el as HTMLElement).dataset?.testid ?? null,
      }))
      const sonnerToaster = document.querySelector('[data-sonner-toaster]')
      return {
        popoverExists: popover != null,
        radixMenus: menus,
        sonnerToasterExists: sonnerToaster != null,
      }
    })
    log(`Run2: final radix/toaster state ${JSON.stringify(radixState)}`)
    log('========== RUN 2 END ==========')
  })
})

async function findJobIdByName(jobName: string): Promise<string | null> {
  return browser.execute((jobName: string) => {
    const allElements = document.querySelectorAll('[data-testid]')
    for (const el of allElements) {
      const testId = el.getAttribute('data-testid')
      if (testId && testId.endsWith('-name') && el.textContent?.trim() === jobName) {
        return testId.replace('background-job-', '').replace('-name', '')
      }
    }
    return null
  }, jobName)
}

async function installPointerListeners(label: string): Promise<void> {
  await browser.execute((label: string) => {
    const w = window as unknown as { __diag?: { label: string, events: unknown[], registeredAt: number } }
    w.__diag = { label, events: [], registeredAt: Date.now() }
    const push = (e: Event): void => {
      const t = e.target as HTMLElement | null
      const cs = t ? window.getComputedStyle(t) : null
      const me = e as MouseEvent
      w.__diag!.events.push({
        type: e.type,
        rel: ((Date.now() - w.__diag!.registeredAt)).toString().padStart(5, ' '),
        x: typeof me.clientX === 'number' ? me.clientX : null,
        y: typeof me.clientY === 'number' ? me.clientY : null,
        button: typeof me.button === 'number' ? me.button : null,
        targetTestId: t?.dataset?.testid ?? null,
        targetTag: t?.tagName ?? null,
        targetRole: t?.getAttribute?.('role'),
        targetPointerEvents: cs?.pointerEvents ?? null,
      })
    }
    const events = [
      'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
      'mousedown', 'mouseup', 'mousemove', 'click', 'contextmenu',
      'focus', 'blur', 'focusin', 'focusout',
    ]
    for (const evt of events) {
      document.addEventListener(evt, push, true)
      window.addEventListener(evt, push, true)
    }
  }, label)
}

async function dumpPointerEvents(label: string): Promise<void> {
  const events = await browser.execute(() => {
    const w = window as unknown as { __diag?: { events: unknown[] } }
    return JSON.parse(JSON.stringify(w.__diag?.events ?? []))
  })
  await browser.execute(() => {
    const w = window as unknown as { __diag?: { events: unknown[] } }
    if (w.__diag) w.__diag.events = []
  })
  log(`${label}: ${events.length} events captured`)
  for (const e of events) {
    log(`  ${label}: ${JSON.stringify(e)}`)
  }
}

async function snapshotDom(label: string, jobId: string): Promise<void> {
  const data = await browser.execute((jobId: string) => {
    const getRect = (el: Element | null) => {
      if (!el) return null
      const r = (el as HTMLElement).getBoundingClientRect()
      const cs = window.getComputedStyle(el as HTMLElement)
      return {
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
        zIndex: cs.zIndex,
        position: cs.position,
        pointerEvents: cs.pointerEvents,
        visibility: cs.visibility,
        opacity: cs.opacity,
        display: cs.display,
      }
    }

    const deleteMenu = document.querySelector(`[data-testid="background-job-${jobId}-delete-menu"]`) as HTMLElement | null
    const stopAllMenu = document.querySelector(`[data-testid="background-job-${jobId}-stop-all-menu"]`) as HTMLElement | null
    const toast = document.querySelector('[data-sonner-toast]') as HTMLElement | null
    const toaster = document.querySelector('[data-sonner-toaster]') as HTMLElement | null
    const popover = document.querySelector('[data-testid="background-jobs-list"]') as HTMLElement | null
    const jobItem = document.querySelector(`[data-testid="background-job-${jobId}"]`) as HTMLElement | null

    let elemAtMenuCoords: Array<{ tag: string; testId: string | null; role: string | null; pointerEvents: string | null }> = []
    if (deleteMenu) {
      const r = deleteMenu.getBoundingClientRect()
      const cx = Math.round(r.x + r.width / 2)
      const cy = Math.round(r.y + r.height / 2)
      const stack = document.elementsFromPoint(cx, cy)
      elemAtMenuCoords = stack.slice(0, 8).map((el) => {
        const cs = window.getComputedStyle(el as HTMLElement)
        return {
          tag: el.tagName,
          testId: (el as HTMLElement).dataset?.testid ?? null,
          role: el.getAttribute('role'),
          pointerEvents: cs.pointerEvents,
        }
      })
    }

    const radixMenus = Array.from(document.querySelectorAll('[role="menu"]')).map((el) => ({
      state: el.getAttribute('data-state'),
      testId: (el as HTMLElement).dataset?.testid ?? null,
      parentTag: el.parentElement?.tagName ?? null,
      rect: getRect(el),
    }))

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      docHasFocus: document.hasFocus(),
      activeTestId: (document.activeElement as HTMLElement | null)?.dataset?.testid ?? null,
      deleteMenu: getRect(deleteMenu),
      stopAllMenu: getRect(stopAllMenu),
      toast: getRect(toast),
      toaster: getRect(toaster),
      popover: getRect(popover),
      jobItem: getRect(jobItem),
      radixMenuCount: radixMenus.length,
      radixMenus,
      radixMenuItemCount: document.querySelectorAll('[role="menuitem"]').length,
      elemAtDeleteMenuCenter: elemAtMenuCoords,
    }
  }, jobId)

  log(`${label}: ${JSON.stringify(data)}`)
}
