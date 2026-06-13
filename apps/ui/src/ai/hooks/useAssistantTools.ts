import { useMemo } from "react"
import { useAssistantApi, type Tool } from "@assistant-ui/react"

/**
 * Returns the tools currently registered in the assistant-ui main
 * thread's model context, keyed by toolName. Used by
 * `ReverseProxyChatTransport` on HarmonyOS to pass tools to
 * `streamText` so the LLM can call them in-process in the renderer.
 *
 * The assistant-ui runtime manages its own re-rendering: when a
 * `makeAssistantTool` component mounts or a registered tool changes,
 * the runtime fires `thread.modelContextUpdate`, which causes
 * `useAssistantApi` to re-render its consumers. The `useMemo` deps
 * list only `api` because `useAssistantApi` returns a stable
 * reference across renders; the runtime triggers the re-render.
 *
 * Returns an empty object (never `undefined`) when the runtime is
 * not available or no tools are registered, so callers can iterate
 * without a null check.
 */
export function useAssistantTools(): Record<string, Tool> {
  const api = useAssistantApi()
  return useMemo<Record<string, Tool>>(() => {
    try {
      const ctx = api.threads().thread("main").getModelContext()
      const tools = (ctx.tools ?? {}) as Record<string, Tool>
      return tools
    } catch {
      return {}
    }
  }, [api])
}