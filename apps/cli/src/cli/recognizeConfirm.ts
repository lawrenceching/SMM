import * as readline from 'node:readline'

export function formatRecognizePrompt(candidate: {
  title: string
  year?: string
}): string {
  const label =
    candidate.year !== undefined
      ? `${candidate.title} (${candidate.year})`
      : candidate.title
  return `Is it "${label}"? [Y/n]`
}

/** Returns true if user accepts (empty / y / yes). */
export async function confirmRecognizeCandidate(
  candidate: { title: string; year?: string },
  options: { yes?: boolean; ask?: (question: string) => Promise<string> } = {},
): Promise<boolean> {
  if (options.yes) return true
  const ask =
    options.ask ??
    (async (question: string) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise<string>((resolve) => {
        rl.question(question + ' ', resolve)
      })
      rl.close()
      return answer
    })
  const raw = (await ask(formatRecognizePrompt(candidate))).trim().toLowerCase()
  if (raw === '' || raw === 'y' || raw === 'yes') return true
  return false
}
