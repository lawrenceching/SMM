import { useEffect, useState } from "react"
import { useAssistantApi, type Tool } from "@assistant-ui/react"

/**
 * Returns the tools currently registered in the assistant-ui main
 * thread's model context, keyed by toolName. Used by
 * `ReverseProxyChatTransport` on HarmonyOS to pass tools to
 * `streamText` so the LLM can call them in-process in the renderer.
 *
 * **Must be called inside `<AssistantRuntimeProvider>`** (i.e., inside
 * `<AuiProvider>`). Calling it outside the provider causes
 * `useAssistantApi()` to return a throw-on-use proxy (which logs the
 * classic "You are using a component or hook that requires an
 * AuiProvider" error), and the hook returns an empty tools map —
 * the symptom is that tools never reach `streamText`.
 *
 * The hook re-evaluates whenever the assistant-ui runtime fires a
 * `thread.modelContextUpdate` event (which happens on tool
 * registration/unregistration).
 */
export function useAssistantTools(): Record<string, Tool> {
  const api = useAssistantApi()
  const [tools, setTools] = useState<Record<string, Tool>>({})

  useEffect(() => {
    const read = () => {
      try {
        const ctx = api.threads().thread("main").getModelContext()
        const next = (ctx.tools ?? {}) as Record<string, Tool>
        setTools((prev) => {
          if (sameTools(prev, next)) return prev
          console.log(
            "[useAssistantTools] tools updated",
            { names: Object.keys(next) },
          )
          return next
        })
      } catch (err) {
        // This almost certainly means `useAssistantApi()` was called
        // outside <AssistantRuntimeProvider>. Surface loudly so the
        // bug is visible in DevTools instead of silently returning
        // an empty tools map.
        console.error(
          "[useAssistantTools] failed to read model context — is this hook called inside <AssistantRuntimeProvider>?",
          err,
        )
      }
    }

    read()

    // Re-read whenever the assistant-ui runtime fires a
    // `thread.modelContextUpdate` event (which happens when tools
    // are registered/unregistered via `makeAssistantTool`).
    const unsubscribe = api.on("thread.modelContextUpdate", () => {
      read()
    })
    return unsubscribe
  }, [api])

  return tools
}

function sameTools(
  a: Record<string, Tool>,
  b: Record<string, Tool>,
): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false
  }
  return true
}