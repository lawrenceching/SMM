# AI / MCP Plan-Ready Browser Notification

When an AI Assistant or MCP client creates a pending plan via `create-rename-episode-plan` or `create-recognize-episode-plan` and the SMM window/tab is in the background, SMM raises a system notification — "a plan is waiting for approval". Clicking the notification brings the SMM window to the foreground with focus (best-effort). The approval flow itself is out of scope.

Aligned with [docs/dev/notification.md](../../../dev/notification.md) — that document takes precedence where they differ.

[x] New UI component - yes (`PlanReadyNotificationListener` + `planReadyNotification` helper)
[ ] New user config - no
[ ] Electron only - no
[ ] User document - no (covered by `docs/dev/notification.md`)

## 1. Background

The existing `RenameFilesPlanReadyEventListener` / `RecognizeMediaFilePlanReadyEventListener` only invalidate the `['plans']` TanStack Query. They do not raise any visible signal. If the user is on another browser tab, has minimised the window, or is in another app, they have no immediate signal that SMM is waiting for input.

Per the project's "best-effort" guidance, missing the notification because the browser/renderer is suspended is acceptable — the plan stays pending and is visible when the user returns. Guaranteed delivery (main-process / Service Worker + Web Push) is future work.

## 2. Architecture

### 2.1 Project Level Architecture

none — no new server endpoints, no new event types, no schema changes. All wiring happens in `apps/ui`.

| Package / App | Change |
|---------------|--------|
| `apps/ui` | New listener + notification helper; mount in `main.tsx`; locale strings; unit tests |
| `packages/*`, `apps/cli`, `apps/core`, `apps/electron`, `apps/ohos` | none |

### 2.2 App Level Architecture

```mermaid
sequenceDiagram
    autonumber
    participant SIO as Socket.IO plan-ready event
    participant L as PlanReadyNotificationListener
    participant N as planReadyNotification helper
    participant OS as OS Notification
    participant W as SMM window

    SIO->>L: renameFilesPlanReady / recognizeMediaFilePlanReady {taskId}
    L->>N: showPlanReadyNotification(taskId)
    N->>N: snapshot document.hidden; Notification available AND permission === "granted"?
    alt document.hidden AND granted
        N->>OS: new Notification(title, { body, tag: "smm-plan-ready-" + taskId })
        OS->>N: user clicks notification
        N->>W: window.focus() (best-effort)
    else visible OR blocked OR unavailable
        Note over N: silent no-op — existing plans invalidation only
    end
```

### 2.3 Key Design Decisions

1. **Reuse existing events.** Trigger is `renameFilesPlanReady` / `recognizeMediaFilePlanReady` only when a plan stays pending (no `metadata.write` auto-apply).
2. **Renderer-only, best-effort.** One shared `apps/ui` implementation for browser, Electron, and HarmonyOS renderers. No Electron IPC, no main-process flash.
3. **No toast when visible (FR-3).** When the window is visible, the feature does nothing beyond existing query invalidation — strictly a system notification feature.
4. **Both plan kinds share one message.** Generic "a plan is waiting for your approval"; no per-kind wording, no file paths (NF-4).
5. **Dedupe per plan.** `tag: "smm-plan-ready-<taskId>"` — OS replaces duplicates for the same plan (FR-5).
6. **Never prompt for permission (FR-4).** If `Notification.permission !== "granted"` or the API is missing, silent no-op.
7. **Click → focus is best-effort (FR-2).** `onclick → window.focus()`; minimized-window restore not guaranteed.

## 3. User Stories

### 3.1 Plan Ready While Tab Is in Background

* **Given** the SMM page is open but the tab/window is in the background (`document.hidden === true`) and `Notification.permission === "granted"`
* **When** `create-rename-episode-plan` or `create-recognize-episode-plan` leaves a pending plan and broadcasts the plan-ready Socket.IO event
* **Then** an OS notification appears with title "SMM" and body "A plan is waiting for your approval" (localized)
* **And** clicking the notification focuses the SMM window/tab (best-effort)
* **And** if the document is visible, no OS notification fires

### 3.2 MCP Client Path

* **Given** SMM UI is connected; an external MCP client calls the same plan-creation tools
* **When** the plan stays pending and the plan-ready event is broadcast
* **Then** the renderer shows the same notification as 3.1

### 3.3 Permission Denied / Unsupported Context

* **Given** notifications are blocked, permission is `"default"`/`"denied"`, or the API is unavailable (e.g. Docker over plain HTTP)
* **When** a plan-ready event arrives while the tab is hidden
* **Then** no OS notification is shown, no permission prompt, no console error — silent no-op

### 3.4 Frontend Transport Path (Out of Scope)

* **Given** `ReverseProxyChatTransport` is active
* **When** a plan is updated in-renderer via `/api/updatePlan`
* **Then** this feature does not fire — no server broadcast is involved

## 4. Tasks

### 4.1 Helper

[x] Create `apps/ui/src/lib/planReadyNotification.ts`
    - Exports `showPlanReadyNotification(taskId: string): void`
    - Guards: `document.hidden`, `window.Notification`, `permission === "granted"`
    - `new Notification(title, { body, tag: "smm-plan-ready-" + taskId })`; `onclick → window.focus()`
    - Wrapped in `try/catch`; never calls `Notification.requestPermission()`
[x] Create `apps/ui/src/lib/planReadyNotification.test.ts`

### 4.2 Listener

[x] Create `apps/ui/src/components/eventlisteners/PlanReadyNotificationListener.tsx`
    - Listens for `socket.io_renameFilesPlanReady` and `socket.io_recognizeMediaFilePlanReady`
    - Extracts `taskId` from event detail; calls the helper
[x] Create `apps/ui/src/components/eventlisteners/PlanReadyNotificationListener.test.tsx`
[x] Mount in `apps/ui/src/main.tsx` next to the existing plan-ready listeners

### 4.3 Locale strings

[x] Add `planReady.notification.title` / `planReady.notification.body` to `common.json` for en, zh-CN, zh-HK, zh-TW (project uses namespaced locale files, not `translation.json`)

| Locale | title | body |
|--------|-------|------|
| en | SMM | A plan is waiting for your approval |
| zh-CN | SMM | 有计划需要审批 |
| zh-HK | SMM | 有計劃需要審批 |
| zh-TW | SMM | 有計劃需要審批 |

### 4.4 Post-check

[x] No platform-specific code; existing plan-ready invalidation listeners untouched
[ ] `pnpm typecheck` and `pnpm --filter ui build` pass
[ ] Unit tests for the new files pass

## 5. Backward Compatibility

none.

- No API / config / wire-protocol changes
- Listener is purely additive in the renderer
- Frontend-transport path unchanged

## 6. Documents

- Spec: [docs/dev/notification.md](../../../dev/notification.md)
- This design doc is aligned with that spec (no toast-when-visible; single generic message; tag includes `taskId`)

## 7. Post Verification

[ ] Type check — `pnpm typecheck`
[ ] Unit tests — `pnpm --filter ui exec vitest run src/lib/planReadyNotification.test.ts src/components/eventlisteners/PlanReadyNotificationListener.test.tsx`
[ ] Build — `pnpm --filter ui build`
