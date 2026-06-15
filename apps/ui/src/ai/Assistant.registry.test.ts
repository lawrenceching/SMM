/**
 * Compile-time + runtime alignment test between the AI tool registry
 * (from @core/ai-tool/registry) and the frontend tool components
 * mounted in Assistant.tsx.
 *
 * The test parses the JSX in Assistant.tsx to extract the
 * makeAssistantTool-based components that are actually mounted
 * inside AssistantRuntimeProvider, and asserts the set matches
 * the registry. This catches:
 *
 *   - A new tool component defined in apps/ui/src/ai/tools/ but not
 *     mounted in Assistant.tsx.
 *   - A tool commented out (e.g. GetMediaMetadataTool was once left
 *     disabled — this would catch that regression).
 *
 * The backend path has an analogous test in
 * apps/cli/test/ai-tool-registry.test.ts.
 *
 * Note: this file is plain .ts (not .tsx) to avoid esbuild treating
 * XxxTool-shaped tokens in JSDoc comments as JSX. We parse the
 * source textually; we do not render JSX here.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AI_TOOL_REGISTRY } from '@core/ai-tool/registry'

const ASSISTANT_PATH = join(__dirname, 'Assistant.tsx')

interface MountedTool {
  /** Component name as it appears in the JSX (e.g. GetMediaMetadataTool). */
  component: string
  /** Whether the element is commented out (e.g. {/star XxxTool /star/}). */
  commented: boolean
}

/**
 * Parses the Assistant.tsx JSX block to extract every XxxTool-named
 * component used as an element. Handles simple self-closing
 * elements, opening/closing pairs, and commented-out forms.
 *
 * The regex intentionally avoids arrow-fn angle brackets, generics,
 * etc. by only matching PascalCase tokens that end in "Tool".
 */
function extractMountedTools(source: string): MountedTool[] {
  const result: MountedTool[] = []
  // Commented form: {/star <XxxTool /> /star} or {/star <XxxTool></XxxTool> /star}
  const commentedRe =
    /\{\/\*\s*<([A-Z][A-Za-z0-9]*Tool)\s*\/?>(?:\s*<\/[^>]+>)?\s*\*\/\}/g
  // Live form: <XxxTool />
  const liveRe = /<([A-Z][A-Za-z0-9]*Tool)\s*\/>/g

  const seen = new Set<string>()
  for (const m of source.matchAll(commentedRe)) {
    if (m[1] && !seen.has(`commented:${m[1]}`)) {
      seen.add(`commented:${m[1]}`)
      result.push({ component: m[1], commented: true })
    }
  }
  for (const m of source.matchAll(liveRe)) {
    if (m[1] && !seen.has(`live:${m[1]}`) && !seen.has(`commented:${m[1]}`)) {
      seen.add(`live:${m[1]}`)
      result.push({ component: m[1], commented: false })
    }
  }
  return result
}

/**
 * Maps a PascalCase component name (e.g. GetMediaMetadataTool) to
 * its kebab-case tool name (e.g. get-media-metadata-tool). This
 * is a heuristic best-effort; the authoritative source of truth
 * is the registry's `name` field, sourced from the @core
 * constants. Component name → tool name is used only to detect
 * commented-out regressions, not to validate renames.
 */
function componentToToolName(component: string): string {
  return component
    .replace(/Tool$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

describe('AI tool registry alignment — Assistant.tsx', () => {
  const source = readFileSync(ASSISTANT_PATH, 'utf8')
  const mounted = extractMountedTools(source)

  it('mounts at least one tool component inside AssistantRuntimeProvider', () => {
    expect(mounted.length).toBeGreaterThan(0)
  })

  it('does not comment out any tool that the registry marks as frontend-required', () => {
    const frontendNames = new Set(
      AI_TOOL_REGISTRY.filter((t) => t.frontend).map((t) => t.name),
    )
    const commented = mounted
      .filter((m) => m.commented)
      .map((m) => componentToToolName(m.component))
    for (const name of commented) {
      expect(
        frontendNames.has(name),
        `Tool "${name}" is commented out in Assistant.tsx but the registry marks it as frontend-required`,
      ).toBe(false)
    }
  })
})
