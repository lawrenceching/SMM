# Electron e2e

Smoke / automation-chain tests against the **installed** SMM Electron app.

## Prerequisites

- SMM installed (default path below), or set `SMM_ELECTRON_BINARY`
- Dependencies installed from the monorepo root (`pnpm install`)

Default binary:

```text
C:\Users\lawrence\AppData\Local\Programs\SMM\SMM.exe
```

Override:

```bash
export SMM_ELECTRON_BINARY="/path/to/SMM.exe"
```

## Run

From `apps/e2e`:

```bash
pnpm wdio:electron:hello
```

Or:

```bash
pnpm wdio run ./electron/wdio.conf.ts --spec ./electron/hello.e2e.ts
```

`hello.e2e.ts` only checks that the app launches and the window title is non-empty — enough to verify the WDIO + Electron automation chain.

Uses `wdio-electron-service@9` (compatible with this repo's WebdriverIO 9). First run may take several minutes while Chromedriver for Electron's Chromium is downloaded into `~/wdio-cache`.
