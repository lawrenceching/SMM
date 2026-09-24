# Issue: Plan-ready system notification does not appear (Web UI)

**Status:** root cause identified (P2); P1 still needs product decision  
**Related:** [docs/dev/notification.md](./docs/dev/notification.md), PR #56  
**Environment:** SMM Web UI at `http://localhost:8081`, plan created via Cherry Studio → SMM MCP (`create-rename-episode-plan`)

## Repro

1. Open SMM Web UI; minimize the browser window.
2. In Cherry Studio, connect SMM MCP and ask the AI to create a rename plan.
3. **Expected:** OS system notification banner “a plan is waiting for approval”.
4. **Actual:** No banner; entry may appear only in Windows 通知中心.
5. Restore SMM Web UI → `AiBasedRenameEpisodePrompt` appears (plan is pending; approval UI works).

## Confirmed facts

| Fact | Evidence |
|------|----------|
| Plan pipeline works | Prompt opens after returning to the tab |
| Secure context + Notification API present | Console probe |
| Permission starts as `"default"`; no in-app grant UX | Console + user |
| Product never calls `requestPermission()` (FR-4) | `planReadyNotification.ts` |
| Manual foreground `new Notification` works | User smoke |
| Event fires while minimized with `permission: granted` | Timing log |
| App calls `new Notification` (title `SMM`) while `visibilityState: 'hidden'` | Experiment A spy |
| Forced-hidden synthetic event shows banner | Experiment B |
| Real MCP flow: **no banner**, but **通知中心有记录** | Test C |
| Plain timer `new Notification` while minimized: **banner works** | Test D |
| Same `taskId` delivered **twice** ~7ms apart | Timing log + Experiment A |

## Problems

### P1 — Users cannot grant notification permission

**Cause (confirmed):** Requires `Notification.permission === "granted"` but never prompts and has no Settings affordance. Web UI stays on `"default"` → silent no-op until the user grants via DevTools / site settings.

**Fix direction (product decision pending):**
- Settings toggle that calls `requestPermission()` once (preferred: keeps FR-4’s “no surprise prompt on plan-ready”), **or**
- Docs-only: tell users to enable notifications for the site, **or**
- Soften FR-4 for a one-time opt-in UX.

### P2 — Banner missing when minimized (notification only in Action Center)

**Root cause (confirmed):**

1. `renameFilesPlanReady` is delivered **twice** for the same `taskId` (duplicate Socket.IO / dual client — still to pin down).
2. Helper uses a stable `tag: "smm-plan-ready-" + taskId` (by design, FR-5 dedupe).
3. Chromium’s Notification API: replacing a notification with the **same `tag`** does **not** re-alert unless `renotify: true` (default is `false`).
4. Result of double create with same tag within milliseconds: first notification is replaced quietly → **no banner**, leftover quiet entry in 通知中心.
5. Test D used a **single** create with a unique tag → banner OK while minimized. Experiment B also single-fired → banner OK.

```ts
// apps/ui/src/lib/planReadyNotification.ts (current)
new window.Notification(title, {
  body,
  tag: `smm-plan-ready-${taskId}`,
  // missing: renotify: true
})
```

| ID | Hypothesis | Status |
|----|------------|--------|
| H1–H5 | Timing / missing listener / helper never calls Notification | **Rejected** |
| H6 | Duplicate emit + same `tag` without `renotify` suppresses banner | **Confirmed as P2 root cause** |
| H7 | Only in 通知中心, no banner | **Confirmed symptom** (caused by H6) |
| H8 | Page Notification API useless when hidden | **Rejected** — Test D proves banner works when minimized |

### Duplicate `renameFilesPlanReady` delivery (same `taskId` twice)

**Root cause (confirmed by code + log shape): client opens two Socket.IO connections; server `io.emit` once reaches both.**

Evidence from user console (Experiment A):

```
[Socket.IO][DEBUG] Received event: renameFilesPlanReady ...
Dispatched event: socket.io_renameFilesPlanReady
[Socket.IO][DEBUG] Received event: renameFilesPlanReady ...   ← second full receive cycle
Dispatched event: socket.io_renameFilesPlanReady
```

Two complete **Received → Dispatched** cycles ⇒ not “one receive, two document listeners”.  
Server tool emits once (`createRenameEpisodePlan.ts` single `emit({ event: RenameFilesPlanReady.event, ... })`).

Client:

| Call site | File |
|-----------|------|
| `useWebSocket()` | `apps/ui/src/main.tsx` → `AppSwitcher` |
| `useWebSocket()` | `apps/ui/src/components/hooks/useStatusBar.ts` → used by `StatusBar` |

Each `useWebSocket()` call runs `io(...)` and registers its own `onAny`. Module-level `webSocketEventListeners` is shared, so **one server broadcast × two sockets = two handler runs = two DOM dispatches = two notifications**.

`StatusBar` currently only uses `version` from `useStatusBar`, but the hook still calls `useWebSocket()` for `connectionStatus` (unused by StatusBar after refactor) — that is enough to open the second connection.

**Ruled out:**

| Candidate | Why not |
|-----------|---------|
| Server emits twice for one plan | Tool has a single pending-path `emit`; log is two socket receives of the same payload |
| Duplicate `PlanReadyNotificationListener` / document listeners only | Would process one “Received” into two notifies; logs show two “Received” |
| Non-unique `taskId` | Same UUID twice — duplicate delivery, not ID collision |

**Fix direction:** ensure a single shared Socket.IO connection (singleton), and stop calling `useWebSocket()` from `useStatusBar` / `AppSwitcher`.

### Fix implemented (branch `fix/single-socket-io-connection`)

| Change | Detail |
|--------|--------|
| `SocketBridge` in `main.tsx` | Sole mount that calls `useWebSocket()` |
| `AppSwitcher` | No longer calls `useWebSocket()` |
| `useStatusBar` | Reads `useWebSocketStore` only — never `io()` / `useWebSocket()` |
| `useWebSocket` | Process-wide ref-counted singleton; second mount reuses socket |
| `webSocketStore` | Shared `status` for StatusBar / others |

Document fan-out unchanged: `WebSocketHandlers` → `socket.io_*` → plan / notification listeners.

## Proposed fixes

### Fix P2 (code — ready to implement)

1. Pass `renotify: true` in `showPlanReadyNotification` options so same-`tag` replace still shows a banner.
2. Unit test: assert `new Notification` is called with `renotify: true`.
3. (Follow-up) Find and remove duplicate `renameFilesPlanReady` delivery (UI double-subscribe or server double-emit).

### Fix P1 (product — needs decision)

Add an explicit opt-in (e.g. Settings → “Notify when a plan needs approval”) that calls `Notification.requestPermission()` when enabled; keep no auto-prompt on plan-ready events.

## Progress log

- [x] Spec + implementation review.
- [x] P1 confirmed (`permission: default`, no grant UX).
- [x] Timing / spy / fake event / Tests C–D.
- [x] P2 root cause: duplicate same-`tag` Notification without `renotify` (symptom amplified by dual socket).
- [x] Duplicate delivery root cause: **two client Socket.IO connections** (`AppSwitcher` + `useStatusBar`), not server double-emit.
- [x] Implement single shared socket (`SocketBridge` + singleton `useWebSocket` + StatusBar reads store).
- [ ] Optionally add `renotify: true` as FR-5 safety net.
- [ ] Product decision + implement P1 opt-in.
- [ ] Manual verify: Console shows one `[Socket.IO] Connecting` / one `Received renameFilesPlanReady` per plan.

## Verification evidence (abbrev.)

**Experiment A spy (real MCP, minimized):** `[Notification spy] { title: 'SMM', hidden: true, visibilityState: 'hidden' }` ×2; no banner.

**Experiment B:** forced `document.hidden`, synthetic event → banner OK (`visibilityState` still `visible`).

**Test C:** no banner; **通知中心 has SMM record**.

**Test D:**
```js
setTimeout(() => new Notification("SMM minimized timer", { body: "...", tag: "smm-min-timer" }), 3000)
```
while Chrome minimized → **banner OK**.

## Out of scope / notes

- Approval flow is fine.
- Spec NF-1 best-effort / §9 SW+Push / Electron main-process remain valid for stronger delivery later; P2 banner gap does not require that for this bug.
- Electron may still grant permission by default; P1 is mainly Web UI.
