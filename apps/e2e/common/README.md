# Common Specs

This folder holds e2e spec files that capable to run in both browser(local and remote), Electron and HarmonyOS environments.

Technically, it requires test implemented only rely on browser API.

## Test Environment

| Env | Test Target |
| --- | --- |
| Local | apps/ui (frontend server) + apps/cli (backend server) |
| Electron | The Electron distribution SMM.exe | 
| Docker | Docker Container and access via browser |
| HarmonyOS(ohos) | Connects to HarmonyOS app via electron remote debugging port | 

### Docker

Requires pre-built `smm:latest` and Docker CLI.

```bash
bun ci/run-e2e-test.ts --platform docker --spec ./common/movie/SearchMovie.e2e.ts
```

`--spec` is required (no default suite). Artifacts: `{task}/main.log` (incl. BiDi browser console), `{task}/container.log`, `wdio-report/`, `network-log/`.

## `common/manual`

On-demand / long-running specs (yt-dlp, transcription, ffmpeg, real media fixtures).
Not in default CI batch; run explicitly with `--spec ./common/manual/*.e2e.ts` (including Docker).

Platform matrix and `@supports` audit: [common-e2e-tests-verification.md](../common-e2e-tests-verification.md).

Host-FS-heavy cases (`Transcribe`, `ConvertVideoFormat`, `MediaFileProperties`, `MusicPanel-Transcribe`) call `skipIfOhos` because they still need local disk + host tools.

## Test data: init vs seed

| Goal | Setup |
| --- | --- |
| **Test initialization / search / proxy / custom hosts** | Import via menu/event (`createAndImportFolderViaBrowser`, Gherkin init steps); expect TMDB/TVDB traffic and long waits |
| **Test anything else** (rename, scrape, unlink, MCP, …) | **Seed recognized folder:** `createTestFolderViaBrowser` → `importFolderWithMediaMetadata` → `page.refresh()` → `waitForFolderName`. Avoids external DB calls and batch/Docker flake |

Details and examples: [common-e2e-tests-verification.md § Non-init specs](../common-e2e-tests-verification.md#non-init-specs-seed-recognized-folders).