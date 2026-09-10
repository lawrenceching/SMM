export const YTDLP_JS_RUNTIME_IDS = ["deno", "node", "bun", "quickjs"] as const

export type YtdlpJsRuntimeId = (typeof YTDLP_JS_RUNTIME_IDS)[number]

export const DEFAULT_YTDLP_JS_RUNTIME_ID: YtdlpJsRuntimeId = "quickjs"

export type YtdlpJsRuntimeLabelKey =
  | "downloadVideo.jsRuntimeDeno"
  | "downloadVideo.jsRuntimeNode"
  | "downloadVideo.jsRuntimeBun"
  | "downloadVideo.jsRuntimeQuickJS"

const LABEL_KEYS: Record<YtdlpJsRuntimeId, YtdlpJsRuntimeLabelKey> = {
  deno: "downloadVideo.jsRuntimeDeno",
  node: "downloadVideo.jsRuntimeNode",
  bun: "downloadVideo.jsRuntimeBun",
  quickjs: "downloadVideo.jsRuntimeQuickJS",
}

export function ytdlpJsRuntimeLabelKey(id: YtdlpJsRuntimeId): YtdlpJsRuntimeLabelKey {
  return LABEL_KEYS[id]
}
