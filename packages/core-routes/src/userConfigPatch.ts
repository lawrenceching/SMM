import { applyPatch, type Operation } from "fast-json-patch";
import type { UserConfig } from "@smm/types";
import { isUserConfigKey, USER_CONFIG_KEYS, validateUserConfig } from "@smm/core";

const ALLOWED_OPS = new Set(["add", "remove", "replace"]);
const FORBIDDEN_TOKENS = new Set(["__proto__", "constructor", "prototype"]);

type Shape =
  | { kind: "scalar" }
  | { kind: "object"; fields: Record<string, Shape> }
  | { kind: "stringArray" }
  | { kind: "objectArray"; item: Shape }
  | { kind: "map"; value: Shape };

const scalar: Shape = { kind: "scalar" };

const provider: Shape = {
  kind: "object",
  fields: {
    name: scalar,
    baseURL: scalar,
    apiKey: scalar,
    model: scalar,
  },
};

/** JSON Pointer shapes for UserConfig. Unknown keys and deeper paths are rejected. */
const SHAPES: Record<keyof UserConfig, Shape> = {
  applicationLanguage: scalar,
  tmdb: { kind: "object", fields: { host: scalar, apiKey: scalar, httpProxy: scalar } },
  tvdb: { kind: "object", fields: { host: scalar, apiKey: scalar, httpProxy: scalar } },
  primaryDatabase: scalar,
  preferMediaLanguage: scalar,
  folders: { kind: "stringArray" },
  selectedFolder: scalar,
  renameRules: { kind: "stringArray" },
  dryRun: scalar,
  ai: { kind: "map", value: provider },
  selectedAI: scalar,
  aiProviders: { kind: "objectArray", item: provider },
  selectedAIProvider: scalar,
  selectedTMDBIntance: scalar,
  selectedRenameRule: scalar,
  enableMcpServer: scalar,
  mcpHost: scalar,
  mcpPort: scalar,
  anonymousTelemetryConsent: scalar,
  ytdlpExecutablePath: scalar,
  ytdlpProxy: scalar,
  ffmpegExecutablePath: scalar,
  videoCaptionerExecutablePath: scalar,
  useBundledFfmpegForVideoCaptioner: scalar,
  quickjsExecutablePath: scalar,
  aiAgent: {
    kind: "object",
    fields: {
      permissions: { kind: "stringArray" },
    },
  },
};

export interface UserConfigPatchInput {
  op: string;
  path: string;
  value?: unknown;
  from?: string;
}

function unescapeToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

function isArrayIndex(token: string): boolean {
  return token === "-" || /^(0|[1-9]\d*)$/.test(token);
}

function assertShape(shape: Shape, tokens: string[]): void {
  if (tokens.length === 0) return;
  const [head, ...rest] = tokens;
  if (head === undefined || FORBIDDEN_TOKENS.has(head)) {
    throw new Error("JSON Patch path is not allowed");
  }
  switch (shape.kind) {
    case "scalar":
      throw new Error("JSON Patch path is not allowed");
    case "object": {
      const child = shape.fields[head];
      if (!child) throw new Error("JSON Patch path is not allowed");
      assertShape(child, rest);
      return;
    }
    case "stringArray":
      if (!isArrayIndex(head) || rest.length > 0) {
        throw new Error("JSON Patch path is not allowed");
      }
      return;
    case "objectArray":
      if (!isArrayIndex(head)) throw new Error("JSON Patch path is not allowed");
      assertShape(shape.item, rest);
      return;
    case "map":
      assertShape(shape.value, rest);
      return;
  }
}

function assertPath(path: string): void {
  if (path === "" || !path.startsWith("/")) {
    throw new Error("JSON Patch path is not allowed");
  }
  const tokens = path.slice(1).split("/").map(unescapeToken);
  const [head, ...rest] = tokens;
  if (!head || FORBIDDEN_TOKENS.has(head) || !isUserConfigKey(head)) {
    throw new Error("JSON Patch path is not allowed");
  }
  assertShape(SHAPES[head], rest);
}

function assertOperation(operation: UserConfigPatchInput): void {
  if (!ALLOWED_OPS.has(operation.op)) {
    throw new Error(`Unsupported JSON Patch operation: ${operation.op}`);
  }
  if (operation.op !== "remove" && !Object.prototype.hasOwnProperty.call(operation, "value")) {
    throw new Error("JSON Patch add and replace require a value");
  }
  assertPath(operation.path);
}

function ensureArrayParents(
  document: UserConfig,
  patch: readonly UserConfigPatchInput[],
): UserConfig {
  const next: UserConfig = { ...document };
  for (const operation of patch) {
    if (operation.path.startsWith("/folders/") && !Array.isArray(next.folders)) {
      next.folders = [];
    }
    if (operation.path.startsWith("/renameRules/") && !Array.isArray(next.renameRules)) {
      next.renameRules = [];
    }
    if (operation.path.startsWith("/aiProviders/") && !Array.isArray(next.aiProviders)) {
      next.aiProviders = [];
    }
    if (operation.path.startsWith("/aiAgent/permissions/") && next.aiAgent == null) {
      next.aiAgent = { permissions: [] };
    }
  }
  return next;
}

/**
 * Applies a restricted RFC 6902 patch to a user config document.
 * Uses fast-json-patch for the update, then validates the result.
 * Does not mutate `document` and does not fill keys the document did not contain.
 */
export function applyUserConfigPatch(
  document: UserConfig,
  patch: readonly UserConfigPatchInput[],
): UserConfig {
  for (const operation of patch) {
    assertOperation(operation);
  }
  const prepared = ensureArrayParents(document, patch);
  const operations = patch.map((operation) => {
    if (operation.op === "remove") {
      return { op: "remove" as const, path: operation.path };
    }
    return {
      op: operation.op as "add" | "replace",
      path: operation.path,
      value: operation.value,
    };
  }) satisfies Operation[];

  const result = applyPatch(prepared, operations, true, false);
  const validated = validateUserConfig(result.newDocument);
  const next: UserConfig = { ...result.newDocument };
  const writable = next as Record<keyof UserConfig, UserConfig[keyof UserConfig]>;
  for (const key of USER_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(result.newDocument, key)) {
      writable[key] = validated[key];
    }
  }
  return next;
}
