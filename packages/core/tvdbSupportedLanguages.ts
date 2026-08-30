/**
 * Snapshot of TVDB supported languages (ISO 639-3 codes).
 * Source: GET /v4/languages — see docs/superpowers/reference/tvdb_supported_languages.md
 * Update this list when TVDB adds/removes languages.
 */
export const TVDB_SUPPORTED_LANGUAGES = [
  "aar", "abk", "afr", "aka", "amh", "ara", "arg", "asm", "ava", "ave",
  "aym", "aze", "bak", "bam", "bel", "ben", "bih", "bis", "bod", "bos",
  "bre", "bul", "cat", "ces", "cha", "che", "chu", "chv", "cor", "cos",
  "cre", "cym", "dan", "deu", "div", "dzo", "ell", "eng", "epo", "est",
  "eus", "ewe", "fao", "fas", "fij", "fin", "fra", "fry", "ful", "gla",
  "gle", "glg", "glv", "grn", "guj", "hat", "hau", "heb", "her", "hin", "hmo",
  "hrv", "hun", "hye", "ibo", "ido", "iii", "iku", "ile", "ina", "ind",
  "ipk", "isl", "ita", "jav", "jpn", "kal", "kan", "kas", "kat", "kau",
  "kaz", "khm", "kik", "kin", "kir", "kom", "kon", "kor", "kua", "kur",
  "lao", "lat", "lav", "lim", "lin", "lit", "ltz", "lub", "lug", "mah",
  "mal", "mar", "mkd", "mlg", "mlt", "mon", "mri", "msa", "mya", "nau",
  "nav", "nbl", "nde", "ndo", "nep", "nld", "nor", "nya", "oci", "oji",
  "ori", "orm", "oss", "pan", "pli", "pol", "por", "pt", "pus", "que",
  "roh", "ron", "run", "rus", "sag", "san", "sin", "slk", "slv", "sme",
  "smo", "sna", "snd", "som", "sot", "spa", "sqi", "srd", "srp", "ssw",
  "sun", "swa", "swe", "tah", "tam", "tat", "tel", "tgk", "tgl", "tha",
  "tir", "ton", "tsn", "tso", "tuk", "tur", "twi", "uig", "ukr", "urd",
  "uzb", "ven", "vie", "vol", "wln", "wol", "xho", "yid", "yor", "yue",
  "zha", "zho", "zhtw", "zul",
] as const;

export function isTvdbLanguageCode(value: string): boolean {
  const code = value.trim().toLowerCase();
  return (TVDB_SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

export function parseTvdbSearchLanguage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      "Missing language value. Use a TVDB ISO 639-3 code such as eng, zho, or yue (example: --lang zho).",
    );
  }
  const lower = trimmed.toLowerCase();
  if (isTvdbLanguageCode(lower)) return lower;
  throw new Error(
    `Unsupported language "${trimmed}". Use a TVDB ISO 639-3 code such as eng, zho, or yue (example: --lang zho).`,
  );
}
