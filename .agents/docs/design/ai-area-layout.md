# AI Area Layout

Add a blank AI Area panel on the right side of the desktop layout, with resizable capability using Shadcn UI's `ResizablePanelGroup`.

[x] New UI component - AI Area placeholder component

## 1. Background

The desktop layout currently uses a CSS grid with 2 columns: sidebar + content. We need to add a third column on the right side — an AI Area — that spans from the Toolbar level down to the StatusBar level. The AI Area is currently a blank placeholder (no AI functionality yet), and users can resize it.

## 2. Project Level Architecture

None.

## 3. App Level Architecture

The `AppV2` desktop layout changes from a 2-column CSS grid to a `ResizablePanelGroup`-based structure:

```
Before (2-column grid):
┌─────────────────────────────────────────┐
│           AppWarningBanner               │
├─────────────────────────────────────────┤
│              Toolbar                     │
├──────────────┬──────────────────────────┤
│   Sidebar    │    Content Panel          │
├──────────────┴──────────────────────────┤
│               StatusBar                  │
└─────────────────────────────────────────┘

After (ResizablePanelGroup nested layout):
┌──────────────────────────────────────────────┐
│              AppWarningBanner                 │
├──────────────────────────┬───────────────────┤
│        Toolbar            │                   │
├──────────┬───────────────┤    AI Area         │
│  Sidebar │  Content      │    (placeholder)   │
│          │  Panel        │                   │
├──────────┴───────────────┴───────────────────┤
│                 StatusBar                     │
└──────────────────────────────────────────────┘
```

**Key changes:**
- Replace the 2-column CSS grid with nested `ResizablePanelGroup` components
- Toolbar is moved inside the left panel (no longer full-width)
- Sidebar resize: replaces manual mouse/touch resize handlers with `ResizablePanelGroup`
- AI Area resize: new `ResizableHandle` between left (sidebar+content) and right (AI Area)
- AI Area constraints: default 25%, max 50%, min 100px

**Files affected:**
- `apps/ui/src/AppV2.tsx` — main layout restructuring
- `apps/ui/src/components/AIArea.tsx` — new blank placeholder component

## 4. User Stories

### 4.1 Show AI Area on the right side

* **Given** the user opens the application in desktop mode
* **When** the page loads
* **Then** an AI Area placeholder panel is visible on the right side, occupying ~25% of the width

### 4.2 Resize AI Area

* **Given** the AI Area is visible on the right side
* **When** the user drags the resize handle between the content panel and AI Area
* **Then** the AI Area width adjusts smoothly within constraints (min 100px, max 50% of total width)

### 4.3 Resize Sidebar

* **Given** the sidebar is visible on the left side
* **When** the user drags the resize handle between the sidebar and content panel
* **Then** the sidebar width adjusts smoothly (same behavior as before, but powered by ResizablePanelGroup)

## 5. Tasks

### 5.1 New UI Component

[x] Task 1: Create `AIArea.tsx` placeholder component — a simple blank panel with a title "AI Area" and minimal styling
[x] Task 2: Restructure `AppV2.tsx` layout — replace CSS grid with nested `ResizablePanelGroup`:
  - Outer `ResizablePanelGroup` (horizontal): left panel | handle | AI Area
  - Left panel contains: Toolbar + inner `ResizablePanelGroup` (sidebar | handle | content)
  - Apply constraints: AI Area `defaultSize={25}`, `maxSize={50}`, `minSize={10}` (relative), enforce 100px min via `minSize` calculation or CSS
[x] Task 3: Remove old manual sidebar resize code (mouse/touch event handlers, `isResizing` state, `sidebarWidth` state, resize refs, overlay styles) from `AppV2.tsx`
[x] Task 4: Preserve existing sidebar min/max width behavior using `ResizablePanel` `minSize`/`maxSize` props

### 5.2 Toggle AI Area

[x] Task 1: Add `onToggleAIArea` and `isAIAreaCollapsed` props to `Toolbar` component
[x] Task 2: Add AI area toggle button with `PanelRightClose`/`PanelRightOpen` icons on the right side of Toolbar (alongside ViewSwitcher)
[x] Task 3: Add AI area collapse state (`isAIAreaCollapsed`), panel ref, and toggle handler in `AppV2Content`
[x] Task 4: Wire `ResizablePanel` `collapsible` + `collapsedSize={0}` + `onCollapse`/`onExpand` callbacks to keep state in sync with both drag and button toggle

## 6. Backward Compatibility

- The layout change is desktop-only (`AppV2`). Mobile layout (`AppNavigation`) is unaffected.
- No API changes, no config changes.
- The existing `<Assistant />` component (AI chat overlay) is already mounted globally and should NOT be removed; the new AI Area is a separate, non-overlapping panel.

## 7. Documents

None required — this is a UI-only change with no user-facing documentation impact at this stage.

## 8. Post Verification

[ ] Build
    Run `pnpm run build` and expect build succeeded
[x] Unit tests
    Run `pnpm run test` and expect all unit tests succeeded
[ ] Typecheck
    Run `pnpm run typecheck` and expect no errors
