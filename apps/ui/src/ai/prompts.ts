/**
 * @deprecated The shared system prompt now lives in
 * `@core/ai-tool/systemPrompt` so that the backend (`ChatTask.ts`)
 * and the frontend (`ReverseProxyChatTransport`) can import it from
 * the same source. This module is kept as a re-export shim for
 * legacy import sites.
 *
 * New code should import directly from `@core/ai-tool/systemPrompt`.
 */
import { SYSTEM_PROMPT } from '@core/ai-tool/systemPrompt'

export { SYSTEM_PROMPT }

/**
 * @deprecated Kept for backward compatibility — legacy import sites
 * still reference `prompts.system`. New code should import
 * `SYSTEM_PROMPT` directly from `@core/ai-tool/systemPrompt`.
 */
export const prompts = {
  system: SYSTEM_PROMPT,
  // Reserved for future UI-only prompt snippets.
  findVdeoFileForEpisode: `帮我匹配每一集对应的视频文件`,
}
