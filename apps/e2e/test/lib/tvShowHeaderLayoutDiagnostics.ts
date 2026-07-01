import { browser } from '@wdio/globals'

/** Tailwind @container breakpoints from TvShowPanelHeader.tsx */
const CONTAINER_BREAKPOINTS = {
  recognizeInline: 410,
  renameInline: 310,
  scrapeInline: 220,
  subtitleInline: 200,
  layoutSwitcherInline: 520,
} as const

export type TvShowHeaderLayoutDiagnostics = {
  context: string
  viewport: { innerWidth: number; innerHeight: number; outerWidth: number; outerHeight: number }
  document: { clientWidth: number; clientHeight: number }
  windowPosition: { x: number; y: number; width: number; height: number } | null
  sidebar: { width: number; height: number } | null
  mainContentPanel: { width: number; height: number } | null
  tvShowHeaderContainer: {
    width: number
    height: number
    containerType: string
  } | null
  buttons: {
    recognize: ButtonLayoutSnapshot
    rename: ButtonLayoutSnapshot
    scrape: ButtonLayoutSnapshot
    more: ButtonLayoutSnapshot
  }
  containerQueryAnalysis: {
    containerWidth: number | null
    recognizeInlineExpected: boolean
    renameInlineExpected: boolean
    recognizeHiddenByContainerQuery: boolean | null
    renameHiddenByContainerQuery: boolean | null
  }
  conclusion: string
}

type ButtonLayoutSnapshot = {
  exists: boolean
  disabled: boolean
  wdioDisplayed: boolean
  wdioClickable: boolean
  rect: { width: number; height: number; top: number; left: number } | null
  computed: {
    display: string
    visibility: string
    opacity: string
    pointerEvents: string
  } | null
  className: string | null
}

async function snapshotButton(
  testId: string,
  wdioDisplayed: boolean,
  wdioClickable: boolean,
): Promise<ButtonLayoutSnapshot> {
  return browser.execute(
    (id, displayed, clickable) => {
      const el = document.querySelector(`[data-testid="${id}"]`)
      if (!el) {
        return {
          exists: false,
          disabled: false,
          wdioDisplayed: displayed,
          wdioClickable: clickable,
          rect: null,
          computed: null,
          className: null,
        }
      }
      const htmlEl = el as HTMLElement
      const rect = htmlEl.getBoundingClientRect()
      const style = window.getComputedStyle(htmlEl)
      return {
        exists: true,
        disabled: (htmlEl as HTMLButtonElement).disabled ?? false,
        wdioDisplayed: displayed,
        wdioClickable: clickable,
        rect: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
        },
        computed: {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
        },
        className: htmlEl.className,
      }
    },
    testId,
    wdioDisplayed,
    wdioClickable,
  ) as Promise<ButtonLayoutSnapshot>
}

async function snapshotMoreButton(
  wdioDisplayed: boolean,
  wdioClickable: boolean,
): Promise<ButtonLayoutSnapshot> {
  return browser.execute((displayed, clickable) => {
    const el =
      document.querySelector('button[aria-label="More"]') ??
      document.querySelector('button[aria-label="更多"]')
    if (!el) {
      return {
        exists: false,
        disabled: false,
        wdioDisplayed: displayed,
        wdioClickable: clickable,
        rect: null,
        computed: null,
        className: null,
      }
    }
    const htmlEl = el as HTMLElement
    const rect = htmlEl.getBoundingClientRect()
    const style = window.getComputedStyle(htmlEl)
    return {
      exists: true,
      disabled: (htmlEl as HTMLButtonElement).disabled ?? false,
      wdioDisplayed: displayed,
      wdioClickable: clickable,
      rect: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      },
      computed: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
      },
      className: htmlEl.className,
    }
  }, wdioDisplayed, wdioClickable) as Promise<ButtonLayoutSnapshot>
}

/**
 * Collect layout evidence for TvShowPanelHeader container-query responsiveness.
 * Logs a structured report to stdout (captured in CI main.log).
 */
export async function logTvShowHeaderLayoutDiagnostics(
  context: string,
): Promise<TvShowHeaderLayoutDiagnostics> {
  const recognizeEl = await $('[data-testid="recognize-button"]')
  const renameEl = await $('[data-testid="rename-button"]')
  const scrapeEl = await $('[data-testid="scrape-button"]')
  const moreEl = await $('button[aria-label="More"], button[aria-label="更多"]')

  const [recognizeDisplayed, renameDisplayed, scrapeDisplayed, moreDisplayed] = await Promise.all([
    recognizeEl.isDisplayed().catch(() => false),
    renameEl.isDisplayed().catch(() => false),
    scrapeEl.isDisplayed().catch(() => false),
    moreEl.isDisplayed().catch(() => false),
  ])

  const [recognizeClickable, renameClickable, scrapeClickable, moreClickable] = await Promise.all([
    recognizeEl.isClickable().catch(() => false),
    renameEl.isClickable().catch(() => false),
    scrapeEl.isClickable().catch(() => false),
    moreEl.isClickable().catch(() => false),
  ])

  const layoutShell = await browser.execute(() => {
    function findContainerAncestor(start: Element | null): Element | null {
      let node: Element | null = start
      while (node) {
        if (node.classList.contains('@container')) {
          return node
        }
        node = node.parentElement
      }
      return null
    }

    const recognize = document.querySelector('[data-testid="recognize-button"]')
    const container = findContainerAncestor(recognize)
    const sidebar = document.querySelector('[data-testid="sidebar-container"]')
    const mainPanel = document.querySelector('[data-panel-id]') ?? document.querySelector('[data-panel]')

    const rectOf = (el: Element | null) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { width: Math.round(r.width), height: Math.round(r.height) }
    }

    let containerInfo: {
      width: number
      height: number
      containerType: string
    } | null = null
    if (container) {
      const r = container.getBoundingClientRect()
      const style = window.getComputedStyle(container)
      containerInfo = {
        width: Math.round(r.width),
        height: Math.round(r.height),
        containerType: style.containerType || '(default)',
      }
    }

    return {
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
      },
      document: {
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
      },
      sidebar: rectOf(sidebar),
      mainContentPanel: rectOf(mainPanel),
      tvShowHeaderContainer: containerInfo,
    }
  })

  let windowPosition: TvShowHeaderLayoutDiagnostics['windowPosition'] = null
  try {
    const rect = await browser.getWindowRect()
    windowPosition = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }
  } catch {
    windowPosition = null
  }

  const [recognize, rename, scrape, more] = await Promise.all([
    snapshotButton('recognize-button', recognizeDisplayed, recognizeClickable),
    snapshotButton('rename-button', renameDisplayed, renameClickable),
    snapshotButton('scrape-button', scrapeDisplayed, scrapeClickable),
    snapshotMoreButton(moreDisplayed, moreClickable),
  ])

  const containerWidth = layoutShell.tvShowHeaderContainer?.width ?? null
  const recognizeInlineExpected =
    containerWidth !== null ? containerWidth >= CONTAINER_BREAKPOINTS.recognizeInline : false
  const renameInlineExpected =
    containerWidth !== null ? containerWidth >= CONTAINER_BREAKPOINTS.renameInline : false

  const recognizeHiddenByContainerQuery =
    containerWidth !== null
      ? !recognizeInlineExpected && recognize.computed?.display === 'none'
      : null
  const renameHiddenByContainerQuery =
    containerWidth !== null
      ? !renameInlineExpected && rename.computed?.display === 'none'
      : null

  let conclusion: string
  if (containerWidth === null) {
    conclusion =
      'Could not locate @container header element; container-query hypothesis inconclusive.'
  } else if (recognizeHiddenByContainerQuery || renameHiddenByContainerQuery) {
    conclusion =
      `CONTAINER QUERY LIKELY ROOT CAUSE: header @container width=${containerWidth}px ` +
      `(recognize needs >=${CONTAINER_BREAKPOINTS.recognizeInline}px, rename needs >=${CONTAINER_BREAKPOINTS.renameInline}px) ` +
      `while viewport=${layoutShell.viewport.innerWidth}x${layoutShell.viewport.innerHeight}. ` +
      'Inline buttons use display:none below breakpoint; use More overflow menu instead.'
  } else if (!recognizeDisplayed || !renameDisplayed) {
    conclusion =
      `Buttons not displayed but container width=${containerWidth}px should show them inline. ` +
      'Root cause may NOT be container query — check disabled state or other CSS.'
  } else {
    conclusion =
      `Container width=${containerWidth}px and buttons appear displayed. ` +
      'Container query is unlikely the blocker for this snapshot.'
  }

  const report: TvShowHeaderLayoutDiagnostics = {
    context,
    viewport: layoutShell.viewport,
    document: layoutShell.document,
    windowPosition,
    sidebar: layoutShell.sidebar,
    mainContentPanel: layoutShell.mainContentPanel,
    tvShowHeaderContainer: layoutShell.tvShowHeaderContainer,
    buttons: { recognize, rename, scrape, more },
    containerQueryAnalysis: {
      containerWidth,
      recognizeInlineExpected,
      renameInlineExpected,
      recognizeHiddenByContainerQuery,
      renameHiddenByContainerQuery,
    },
    conclusion,
  }

  console.log('[TVShowHeaderLayoutDIAG]', JSON.stringify(report, null, 2))
  return report
}
