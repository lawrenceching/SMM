/**
 * Parse the output of `ffmpeg -hide_banner -encoders` into a list of
 * encoder names.
 *
 * The output looks like:
 * ```
 * Encoders:
 *  V..... = Video
 *  A..... = Audio
 *  S..... = Subtitle
 *  ------
 *  V..... libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 ...
 *  V..... libx265              libx265 H.265 / HEVC ...
 * ```
 *
 * The leading 6 characters encode the type and capabilities. Encoder
 * names start at column 7. A real encoder name is `[A-Za-z_][A-Za-z0-9_]*`
 * — section-header lines like "V..... = Video" must be rejected because
 * they would otherwise match the `=` token as a "name".
 */
const ENCODER_LINE_PREFIX_RE = /^([VASTD])\.{5}\s+([A-Za-z_][A-Za-z0-9_]*)/;
const SECTION_HEADER_RE = /^[VASTD]\.{5}\s+=/;

export function parseFfmpegEncoders(stdout: string): string[] {
  if (!stdout) return [];
  const result = new Set<string>();
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trimStart();
    if (!line) continue;
    // Skip section headers like "V..... = Video" and the dash separator line.
    if (SECTION_HEADER_RE.test(line)) continue;
    if (line.startsWith("---")) continue;
    const match = line.match(ENCODER_LINE_PREFIX_RE);
    if (!match) continue;
    const name = match[2];
    if (name) {
      result.add(name);
    }
  }
  return Array.from(result).sort();
}
