## 1. Backend API and VideoCaptioner spawn

- [x] 1.1 Extend **`transcribeRequestSchema`** in [`apps/cli/src/route/videocaptioner/Transcribe.ts`](apps/cli/src/route/videocaptioner/Transcribe.ts) with optional **`asr`** enum (`bijian` | `jianying` | `whisper-cpp`) and pass through to **`processVideoCaptionerTranscribe`** / **`transcribeWithVideoCaptioner`**.
- [x] 1.2 Update [`apps/cli/src/utils/VideoCaptioner.ts`](apps/cli/src/utils/VideoCaptioner.ts) **`transcribeWithVideoCaptioner`** to accept resolved ASR (default **`bijian`**) and build **`args`** with **`--asr <value>`** instead of a hardcoded **`bijian`**.
- [x] 1.3 Adjust or add CLI route tests covering omitted **`asr`**, valid **`asr`**, and invalid **`asr`** if present in the repo.

## 2. UI API client and transcribe pipeline

- [x] 2.1 Extend [`apps/ui/src/api/videocaptioner.ts`](apps/ui/src/api/videocaptioner.ts) **`VideoCaptionerTranscribeRequest`** with optional **`asr`** and include it in JSON body when set.
- [x] 2.2 Extend [`apps/ui/src/lib/transcribeFeedback.ts`](apps/ui/src/lib/transcribeFeedback.ts) so **`transcribeTracksWithFeedback`** (and **`transcribeTrackWithFeedback`**) accepts optional ASR and forwards it to **`transcribeWithVideoCaptioner`** per job.
- [x] 2.3 Update [`apps/ui/src/api/videocaptioner.test.ts`](apps/ui/src/api/videocaptioner.test.ts) if it asserts request bodies.

## 3. TranscribeDialog UI and wiring

- [x] 3.1 Add ASR **Select** (from [`apps/ui/src/components/ui/select.tsx`](apps/ui/src/components/ui/select.tsx)) to [`apps/ui/src/components/dialogs/UITranscribeDialog.tsx`](apps/ui/src/components/dialogs/UITranscribeDialog.tsx): state default **`bijian`**, three **`SelectItem`** values, accessible label.
- [x] 3.2 Update [`apps/ui/src/components/dialogs/types.ts`](apps/ui/src/components/dialogs/types.ts) **`UITranscribeDialogProps.onConfirm`** to pass **`selectedIds`** and **`asr`** (e.g. payload object); reset ASR default when dialog opens per existing open/reset pattern.
- [x] 3.3 Update [`apps/ui/src/components/dialogs/TranscribeDialog.tsx`](apps/ui/src/components/dialogs/TranscribeDialog.tsx) to pass **`asr`** into **`transcribeTracksWithFeedback`** on confirm.
- [x] 3.4 Add **`testid`** for the ASR trigger if useful for e2e; update [`apps/ui/src/components/dialogs/UITranscribeDialog.test.tsx`](apps/ui/src/components/dialogs/UITranscribeDialog.test.tsx) for the new control and confirm payload.

## 4. i18n

- [x] 4.1 Add translation keys under **`dialogs.transcribe`** (and option labels) in [`apps/ui/public/locales/`](apps/ui/public/locales/) for **en**, **zh-CN**, **zh-HK**, **zh-TW** consistent with existing transcribe strings.
