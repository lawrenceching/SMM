import * as fs from 'node:fs'
import * as path from 'node:path'

/** Minimal bilingual-friendly SRT for translate/synthesize e2e (no network). */
export const MINIMAL_SRT_BODY = `1
00:00:00,000 --> 00:00:02,000
Hello world

2
00:00:02,000 --> 00:00:04,000
This is a test subtitle
`

export function prepareMinimalSrt(filepath: string): void {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, MINIMAL_SRT_BODY, 'utf8')
}
