# Common Specs

This folder holds e2e spec files that capable to run in both browser(local and remote), Electron and HarmonyOS environments.

Technically, it requires test implemented only rely on browser API.

## `common/manual`

On-demand / long-running specs (yt-dlp, transcription, ffmpeg, real media fixtures).
Excluded from default CI (`wdio.conf.ts` / `ci/run-e2e-test.ts`), same as the former `test/specs/manual`.

Host-FS-heavy cases (`Transcribe`, `ConvertVideoFormat`, `MediaFileProperties`, `MusicPanel-Transcribe`) call `skipIfOhos` because they still need local disk + host tools.
