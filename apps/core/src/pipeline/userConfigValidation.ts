import { isPreferMediaLanguage } from "@smm/utils/locale";
import type {
  LanguageCode,
  OpenAICompatibleConfig,
  PrimaryDatabase,
  TMDBConfig,
  TMDBInstance,
  TVDBConfig,
  UserConfig,
} from "@smm/types";
import { DEFAULT_USER_CONFIG, USER_CONFIG_KEYS } from "./userConfigDefaults";

const LANGUAGE_CODES = ["zh-CN", "zh-HK", "zh-TW", "en"] as const satisfies readonly LanguageCode[];
const PRIMARY_DATABASES = ["TMDB", "TVDB"] as const satisfies readonly PrimaryDatabase[];
const TMDB_INSTANCES = ["public", "customized"] as const satisfies readonly TMDBInstance[];

function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

function validateTmdbConfig(value: unknown): TMDBConfig {
  const obj = assertObject(value, "tmdb");
  return {
    host: assertOptionalString(obj.host, "tmdb.host"),
    apiKey: assertOptionalString(obj.apiKey, "tmdb.apiKey"),
    httpProxy: assertOptionalString(obj.httpProxy, "tmdb.httpProxy"),
  };
}

function validateTvdbConfig(value: unknown): TVDBConfig {
  const obj = assertObject(value, "tvdb");
  return {
    host: assertOptionalString(obj.host, "tvdb.host"),
    apiKey: assertOptionalString(obj.apiKey, "tvdb.apiKey"),
    httpProxy: assertOptionalString(obj.httpProxy, "tvdb.httpProxy"),
  };
}

function validateAiProvider(value: unknown, index: number): OpenAICompatibleConfig {
  const obj = assertObject(value, `aiProviders[${index}]`);
  return {
    name: assertOptionalString(obj.name, `aiProviders[${index}].name`),
    baseURL: assertOptionalString(obj.baseURL, `aiProviders[${index}].baseURL`),
    apiKey: assertOptionalString(obj.apiKey, `aiProviders[${index}].apiKey`),
    model: assertOptionalString(obj.model, `aiProviders[${index}].model`),
  };
}

function validateAiRecord(value: unknown): Record<string, OpenAICompatibleConfig> {
  const obj = assertObject(value, "ai");
  const result: Record<string, OpenAICompatibleConfig> = {};
  for (const [name, entry] of Object.entries(obj)) {
    result[name] = validateAiProvider(entry, 0);
  }
  return result;
}

function validatePort(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${field} must be an integer between 1 and 65535`);
  }
  return value;
}

function validateStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== "string") {
      throw new Error(`${field}[${i}] must be a string`);
    }
  }
  return value as string[];
}

/** Validates a single UserConfig field value; returns the normalized value. */
export function validateUserConfigValue<K extends keyof UserConfig>(
  key: K,
  value: unknown,
): UserConfig[K] {
  switch (key) {
    case "applicationLanguage": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "string" || !(LANGUAGE_CODES as readonly string[]).includes(value)) {
        throw new Error(`applicationLanguage must be one of: ${LANGUAGE_CODES.join(", ")}`);
      }
      return value as UserConfig[K];
    }
    case "tmdb":
      return validateTmdbConfig(value) as UserConfig[K];
    case "tvdb":
      return validateTvdbConfig(value) as UserConfig[K];
    case "primaryDatabase": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "string" || !(PRIMARY_DATABASES as readonly string[]).includes(value)) {
        throw new Error(`primaryDatabase must be one of: ${PRIMARY_DATABASES.join(", ")}`);
      }
      return value as UserConfig[K];
    }
    case "preferMediaLanguage": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "string" || !isPreferMediaLanguage(value)) {
        throw new Error("preferMediaLanguage must be one of: zh-CN, en-US, ja-JP");
      }
      return value as UserConfig[K];
    }
    case "folders":
      return validateStringArray(value, "folders") as UserConfig[K];
    case "selectedFolder": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "string") {
        throw new Error("selectedFolder must be a string");
      }
      return value as UserConfig[K];
    }
    case "renameRules":
      return validateStringArray(value, "renameRules") as UserConfig[K];
    case "dryRun":
      if (typeof value !== "boolean") {
        throw new Error("dryRun must be a boolean");
      }
      return value as UserConfig[K];
    case "ai": {
      if (value === undefined) return undefined as UserConfig[K];
      return validateAiRecord(value) as UserConfig[K];
    }
    case "selectedAI": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "string") {
        throw new Error("selectedAI must be a string");
      }
      return value as UserConfig[K];
    }
    case "aiProviders": {
      if (value === undefined) return undefined as UserConfig[K];
      if (!Array.isArray(value)) {
        throw new Error("aiProviders must be an array");
      }
      return value.map((entry, index) => validateAiProvider(entry, index)) as UserConfig[K];
    }
    case "selectedAIProvider": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "string") {
        throw new Error("selectedAIProvider must be a string");
      }
      return value as UserConfig[K];
    }
    case "selectedTMDBIntance": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "string" || !(TMDB_INSTANCES as readonly string[]).includes(value)) {
        throw new Error(`selectedTMDBIntance must be one of: ${TMDB_INSTANCES.join(", ")}`);
      }
      return value as UserConfig[K];
    }
    case "selectedRenameRule":
      if (typeof value !== "string") {
        throw new Error("selectedRenameRule must be a string");
      }
      return value as UserConfig[K];
    case "enableMcpServer": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "boolean") {
        throw new Error("enableMcpServer must be a boolean");
      }
      return value as UserConfig[K];
    }
    case "mcpHost": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "string" || !value.trim()) {
        throw new Error("mcpHost must be a non-empty string");
      }
      return value as UserConfig[K];
    }
    case "mcpPort": {
      if (value === undefined) return undefined as UserConfig[K];
      return validatePort(value, "mcpPort") as UserConfig[K];
    }
    case "anonymousTelemetryConsent": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "boolean") {
        throw new Error("anonymousTelemetryConsent must be a boolean");
      }
      return value as UserConfig[K];
    }
    case "ytdlpExecutablePath":
    case "ytdlpProxy":
    case "ffmpegExecutablePath":
    case "videoCaptionerExecutablePath":
    case "quickjsExecutablePath": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "string") {
        throw new Error(`${key} must be a string`);
      }
      return value as UserConfig[K];
    }
    case "useBundledFfmpegForVideoCaptioner": {
      if (value === undefined) return undefined as UserConfig[K];
      if (typeof value !== "boolean") {
        throw new Error("useBundledFfmpegForVideoCaptioner must be a boolean");
      }
      return value as UserConfig[K];
    }
    default: {
      const _exhaustive: never = key;
      throw new Error(`Unknown config key: ${String(_exhaustive)}`);
    }
  }
}

/** Validates every known field and strips unknown keys before persisting. */
export function validateUserConfig(config: UserConfig): UserConfig {
  const merged = { ...DEFAULT_USER_CONFIG, ...config };
  const validated = { ...DEFAULT_USER_CONFIG };
  for (const key of USER_CONFIG_KEYS) {
    (validated as Record<string, unknown>)[key] = validateUserConfigValue(key, merged[key]);
  }
  return validated;
}
