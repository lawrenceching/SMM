import * as fs from 'node:fs';
import * as path from 'node:path';

export const SECURE_ENV_NAMES = [
  'TMDB_API_KEY',
  'TVDB_API_KEY',
  'SMM_AUTH_TOKEN',
] as const;

export const MIN_SECRET_LENGTH = 8;
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

export type SecretHit = {
  envName: string;
  relativePath: string;
  lineNumber: number;
};

export function collectSecretsFromEnv(
  env: NodeJS.ProcessEnv,
): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  for (const name of SECURE_ENV_NAMES) {
    const value = (env[name] ?? '').trim();
    if (value.length < MIN_SECRET_LENGTH) continue;
    out.push({ name, value });
  }
  return out;
}

export function redactSecret(value: string): string {
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

/** Placeholder written into e2e/cicd artifacts (must not match MIN_SECRET_LENGTH). */
export const ARTIFACT_SECRET_PLACEHOLDER = '***';

/**
 * Remove known secret env values from text destined for cicd artifacts.
 * Also redacts URI-encoded forms (e.g. `?token=` query params).
 */
export function redactSecretsInText(
  text: string,
  secrets: Array<{ name: string; value: string }> = collectSecretsFromEnv(process.env),
): string {
  if (!text || secrets.length === 0) return text;

  let result = text;
  const sorted = [...secrets].sort((a, b) => b.value.length - a.value.length);
  for (const { value } of sorted) {
    if (value.length < MIN_SECRET_LENGTH) continue;
    result = result.split(value).join(ARTIFACT_SECRET_PLACEHOLDER);
    try {
      const encoded = encodeURIComponent(value);
      if (encoded !== value) {
        result = result.split(encoded).join(ARTIFACT_SECRET_PLACEHOLDER);
      }
    } catch {
      // ignore invalid URI sequences
    }
  }
  return result;
}

export function redactTextFilesInDir(
  rootDir: string,
  secrets: Array<{ name: string; value: string }> = collectSecretsFromEnv(process.env),
): number {
  if (secrets.length === 0) return 0;

  const root = path.resolve(rootDir);
  if (!fs.existsSync(root)) return 0;

  const files: string[] = [];
  walkFiles(root, files);
  let updated = 0;

  for (const file of files) {
    let st: fs.Stats;
    try {
      st = fs.statSync(file);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;

    let buf: Buffer;
    try {
      buf = fs.readFileSync(file);
    } catch {
      continue;
    }
    if (isProbablyBinary(buf)) continue;

    const original = buf.toString('utf8');
    const redacted = redactSecretsInText(original, secrets);
    if (redacted !== original) {
      fs.writeFileSync(file, redacted, 'utf8');
      updated++;
    }
  }

  return updated;
}

export function isProbablyBinary(buffer: Buffer): boolean {
  return buffer.includes(0);
}

function walkFiles(dir: string, files: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
}

export function scanDirectoryForSecrets(
  rootDir: string,
  secrets: Array<{ name: string; value: string }>,
): SecretHit[] {
  if (secrets.length === 0) return [];
  const root = path.resolve(rootDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return [];
  }
  const files: string[] = [];
  walkFiles(root, files);
  const hits: SecretHit[] = [];
  for (const file of files) {
    let st: fs.Stats;
    try {
      st = fs.statSync(file);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
    let buf: Buffer;
    try {
      buf = fs.readFileSync(file);
    } catch {
      continue;
    }
    if (isProbablyBinary(buf)) continue;
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/);
    const relativePath = path.relative(root, file);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const secret of secrets) {
        if (line.includes(secret.value)) {
          hits.push({
            envName: secret.name,
            relativePath,
            lineNumber: i + 1,
          });
        }
      }
    }
  }
  return hits;
}
