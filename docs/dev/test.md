# Test

## E2E Test

E2e Test targets all [supported platform](./supported-platform.md)

```bash
pnpm e2e:web:run --spec './web/Settings-ExternalApp.test.ts'

pnpm e2e:web:run --spec './common/tv/TVShow-Import.e2e.ts'


# CLI
cd apps/e2e && bun test './cli/import-folder.test.ts'
```
