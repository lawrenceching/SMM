export type SubtitleLangKind = "manual" | "auto" | "both";

export interface SubtitleLanguage {
  code: string;
  name: string;
  kind: SubtitleLangKind;
}

/** Language selection passed into a download. `both` writes manual and automatic tracks. */
export interface DownloadSubtitleLang {
  code: string;
  kind: SubtitleLangKind;
}

/** yt-dlp language tag: letters, digits, `.`, `_`, `-`. */
export const SUBTITLE_LANG_CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

export function isSubtitleLangCode(code: string): boolean {
  return SUBTITLE_LANG_CODE.test(code);
}

function stripLogPrefix(line: string): string {
  return line.replace(/^\[[^\]]+\]\s*/, "").trim();
}

interface AccumulatedLang {
  code: string;
  name: string;
  manual: boolean;
  auto: boolean;
}

function kindOf(entry: AccumulatedLang): SubtitleLangKind {
  if (entry.manual && entry.auto) return "both";
  if (entry.auto) return "auto";
  return "manual";
}

/**
 * Parse `yt-dlp --list-subs` stdout.
 * Manual and automatic sections are merged by language code.
 * The same code in both sections becomes `kind: "both"`.
 */
export function parseYtdlpListSubsStdout(stdout: string): SubtitleLanguage[] {
  const byCode = new Map<string, AccumulatedLang>();
  const order: string[] = [];
  let section: "manual" | "auto" | null = null;

  for (const raw of stdout.split(/\r?\n/)) {
    const line = stripLogPrefix(raw);
    if (!line) continue;

    if (/available subtitles for/i.test(line)) {
      section = "manual";
      continue;
    }
    if (/available automatic captions for/i.test(line)) {
      section = "auto";
      continue;
    }
    if (section === null) continue;
    if (/^language\b/i.test(line)) continue;

    const columns = line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
    if (columns.length < 2) continue;
    const code = columns[0] ?? "";
    if (!isSubtitleLangCode(code)) continue;
    const name = columns.length >= 3 ? columns.slice(1, -1).join(" ") : columns[1] ?? code;

    let entry = byCode.get(code);
    if (!entry) {
      entry = { code, name, manual: false, auto: false };
      byCode.set(code, entry);
      order.push(code);
    } else if (entry.name === entry.code && name && name !== code) {
      entry.name = name;
    }
    if (section === "manual") entry.manual = true;
    else entry.auto = true;
  }

  return order.map((code) => {
    const entry = byCode.get(code)!;
    return { code: entry.code, name: entry.name || entry.code, kind: kindOf(entry) };
  });
}
