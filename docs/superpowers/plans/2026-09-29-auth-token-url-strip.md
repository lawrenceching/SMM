# Auth Token URL Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After boot persists `?token=` into localStorage, remove `token` from the address bar via `history.replaceState` without a page reload.

**Architecture:** Extend existing `initAuthTokenFromUrl()` in `apps/ui/src/lib/authToken.ts` (already called from `main.tsx`). No LoginPanel / AuthGate / CLI changes. Spec: `docs/superpowers/specs/2026-09-29-auth-token-url-strip-design.md`.

**Tech Stack:** React UI (`apps/ui`), Vitest, browser `history.replaceState` / `URL` / `URLSearchParams`.

## Global Constraints

- Use `history.replaceState` only (no `location.replace` / full reload).
- Strip only the `token` search param; preserve pathname, other query params, and hash.
- Do not verify the URL token via `/api/hello` before save (unchanged).
- Reuse `saveAuthToken()`; do not duplicate localStorage writes.
- Follow red-green unit testing for production changes in this repo.

## File map

| File | Role |
|------|------|
| `apps/ui/src/lib/authToken.ts` | Extend `initAuthTokenFromUrl()` to strip `token` after save |
| `apps/ui/src/lib/authToken.test.ts` | Unit tests for persist + URL strip |
| `apps/ui/src/main.tsx` | No change (already calls `initAuthTokenFromUrl()`) |

---

### Task 1: Persist URL token then strip via replaceState

**Files:**
- Modify: `apps/ui/src/lib/authToken.ts` (`initAuthTokenFromUrl`)
- Test: `apps/ui/src/lib/authToken.test.ts`

**Interfaces:**
- Consumes: `saveAuthToken(token: string): void`, `readTokenFromUrl()` (module-private), `AUTH_TOKEN_STORAGE_KEY`
- Produces: `initAuthTokenFromUrl(): void` — same signature; after call with `?token=…`, storage holds the token and `window.location.search` has no `token`

- [x] **Step 1: Write the failing tests**

In `apps/ui/src/lib/authToken.test.ts`, update the existing persist test and add a preserve-params test:

```typescript
  it('persists URL token to localStorage and strips token from the URL', () => {
    window.history.replaceState({}, '', '/?token=from-query');
    initAuthTokenFromUrl();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('from-query');
    expect(getAuthToken()).toBe('from-query');
    expect(new URLSearchParams(window.location.search).has('token')).toBe(false);
  });

  it('preserves other query params and hash when stripping token', () => {
    window.history.replaceState({}, '', '/app?foo=1&token=secret&bar=2#section');
    initAuthTokenFromUrl();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('secret');
    expect(window.location.pathname).toBe('/app');
    expect(window.location.hash).toBe('#section');
    const params = new URLSearchParams(window.location.search);
    expect(params.get('foo')).toBe('1');
    expect(params.get('bar')).toBe('2');
    expect(params.has('token')).toBe(false);
  });
```

Keep the existing `prefers URL token over localStorage` and `falls back to localStorage` tests as-is.

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
cd apps/ui && pnpm exec vitest run src/lib/authToken.test.ts
```

Expected: FAIL — after `initAuthTokenFromUrl()`, `token` is still present in `window.location.search` (assertions on `has('token')` fail).

- [x] **Step 3: Implement URL strip in `initAuthTokenFromUrl`**

Replace `initAuthTokenFromUrl` in `apps/ui/src/lib/authToken.ts` with:

```typescript
export function initAuthTokenFromUrl(): void {
  const fromQuery = readTokenFromUrl();
  if (!fromQuery) {
    return;
  }
  saveAuthToken(fromQuery);

  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run:

```bash
cd apps/ui && pnpm exec vitest run src/lib/authToken.test.ts
```

Expected: PASS (all tests in the file).

- [x] **Step 5: Typecheck UI package**

Run:

```bash
cd apps/ui && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/lib/authToken.ts apps/ui/src/lib/authToken.test.ts docs/superpowers/specs/2026-09-29-auth-token-url-strip-design.md docs/superpowers/plans/2026-09-29-auth-token-url-strip.md
git commit -m "$(cat <<'EOF'
feat(ui): strip auth token from URL after persisting to localStorage

EOF
)"
```

(Only commit if the user asked for a commit in this session; otherwise stop after Step 5 and report done.)

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Save `?token=` via existing `saveAuthToken` | Task 1 Step 3 |
| `history.replaceState` strip, no reload | Task 1 Step 3 |
| Preserve path / other params / hash | Task 1 Step 1 + 3 |
| No-op when no token | Existing early return; covered by fallback test |
| Unit tests | Task 1 Steps 1–4 |
| Out of scope: LoginPanel, verifyHello, CLI, full reload | Not in plan |

No placeholders. Single task — feature is one function change.
