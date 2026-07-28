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
Excluded from default CI (`wdio.conf.ts` / `ci/run-e2e-test.ts`), same as the former `test/specs/manual`.

Host-FS-heavy cases (`Transcribe`, `ConvertVideoFormat`, `MediaFileProperties`, `MusicPanel-Transcribe`) call `skipIfOhos` because they still need local disk + host tools.