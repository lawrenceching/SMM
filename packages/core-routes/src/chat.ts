import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { SYSTEM_PROMPT } from "@smm/core/ai-tool/systemPrompt";
import { GET_APPLICATION_CONTEXT } from "@smm/core/types/ai-tools/getApplicationContext";
import { IS_FOLDER_EXIST } from "@smm/core/types/ai-tools/isFolderExist";
import { GET_MEDIA_METADATA } from "@smm/core/types/ai-tools/getMediaMetadata";
import { GET_EPISODES } from "@smm/core/types/ai-tools/getEpisodes";
import { GET_MEDIA_FOLDERS } from "@smm/core/types/ai-tools/getMediaFolders";
import { LIST_FILES_IN_MEDIA_FOLDER } from "@smm/core/types/ai-tools/listFilesInMediaFolder";
import { RENAME_FOLDER } from "@smm/core/types/ai-tools/renameFolder";
import {
  BEGIN_RENAME_FILES_TASK,
  ADD_RENAME_FILE_TO_TASK,
  END_RENAME_FILES_TASK,
} from "@smm/core/types/ai-tools/renameFilesTask";
import {
  BEGIN_RECOGNIZE_TASK,
  ADD_RECOGNIZED_MEDIA_FILE,
  END_RECOGNIZE_TASK,
} from "@smm/core/types/ai-tools/recognizeMediaFileTask";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createChatTools, defaultChatFs } from "./tools/index.ts";
import { sendJson } from "./http.ts";
import type { CoreRoutesConfig, RouteContext, RouteHandler } from "./types.ts";
import type { ChatConfig, ChatFs, ChatRequestBody } from "./chatTypes.ts";
import type { ChatToolsExtraDeps } from "./tools/index.ts";

/**
 * Default `streamText` step count cap. Mirrors the original
 * `ChatTask.processChatRequest` value (`stepCountIs(100)`); multi-step
 * agent loops (rename / recognize) routinely need dozens of steps.
 */
const CHAT_STEP_LIMIT = 100;

/**
 * Result of validating a chat request body. The handler separates
 * "missing AI provider" (400, business error) from "abort before
 * response" (499) from "stream started" (continue with `streamText`).
 *
 * When the outcome is `"stream"`, `providerResult` is the already-
 * resolved AI provider factory result so {@link doChat} does not
 * need to call `config.createAIProvider` a second time.
 */
type ChatRequestOutcome =
  | { kind: "respond"; response: Response }
  | {
      kind: "stream";
      userConfig: import("@smm/core/types").UserConfig;
      body: ChatRequestBody;
      providerResult: {
        provider: unknown;
        model: string;
      };
    };

/**
 * Returns a `Response` for the given `Request` by delegating to
 * {@link streamText}. Mirrors the public surface of the legacy
 * `ChatTask.processChatRequest` so that Hono shells (`apps/cli`) and
 * direct Node callers (`apps/ohos`) can drive chat with the same
 * function.
 *
 * The function is intentionally framework-agnostic — it accepts a
 * `Request` and returns a `Response` (web standards), and the only
 * runtime dependencies (AI provider, filesystem, Socket.IO) are
 * injected through `config`.
 */
export async function doChat(
  config: ChatConfig,
  request: Request,
  extra: ChatToolsExtraDeps = {},
): Promise<Response> {
  const fs: ChatFs = config.fs ?? defaultChatFs();
  const log = config.logger;

  const outcome = await prepareChat(config, request, fs);
  if (outcome.kind === "respond") {
    return outcome.response;
  }

  const { userConfig, body, providerResult } = outcome;
  const { messages, model, tools: frontendToolsInput, system, clientId } = body;

  log?.debug(
    { clientId, hasMessages: Array.isArray(messages), messageCount: messages?.length ?? 0 },
    "doChat: received chat request",
  );
  log?.debug(
    {
      selectedAIProvider: userConfig.selectedAIProvider,
      model: model || providerResult.model,
    },
    "doChat: using AI model configuration",
  );

  // The `messages` field on the wire is `unknown[]`; AI SDK expects
  // `UIMessage[]`. The cast is safe because the UI's
  // `AssistantChatTransport` always sends UI-Message-shaped payloads
  // and the LLM call accepts the broader type.
  const modelMessages = await convertToModelMessages(
    (messages ?? []) as Parameters<typeof convertToModelMessages>[0],
  );

  const provider = providerResult.provider;
  const defaultModel = providerResult.model;
  const providerForAiSdk = provider as ReturnType<typeof createOpenAICompatible>;

  const tools = createChatTools({
    config,
    userConfig,
    clientId,
    abortSignal: request.signal,
    fs,
    extra,
  });

  const result = streamText({
    model: providerForAiSdk.chatModel(model || defaultModel),
    messages: modelMessages,
    // Fall back to the shared core system prompt if the client did
    // not include one (matches the legacy ChatTask behavior — the
    // UI's `AssistantChatTransport` always sends a system prompt
    // via the assistant-ui `ModelContext`).
    system: system || config.systemPrompt || SYSTEM_PROMPT,
    abortSignal: request.signal,
    tools: {
      ...frontendTools(frontendToolsInput as never),
      [GET_APPLICATION_CONTEXT]: tools[GET_APPLICATION_CONTEXT],
      [IS_FOLDER_EXIST]: tools[IS_FOLDER_EXIST],
      [GET_MEDIA_METADATA]: tools[GET_MEDIA_METADATA],
      [GET_EPISODES]: tools[GET_EPISODES],
      [GET_MEDIA_FOLDERS]: tools[GET_MEDIA_FOLDERS],
      [LIST_FILES_IN_MEDIA_FOLDER]: tools[LIST_FILES_IN_MEDIA_FOLDER],
      [RENAME_FOLDER]: tools[RENAME_FOLDER],
      [BEGIN_RENAME_FILES_TASK]: tools[BEGIN_RENAME_FILES_TASK],
      [ADD_RENAME_FILE_TO_TASK]: tools[ADD_RENAME_FILE_TO_TASK],
      [END_RENAME_FILES_TASK]: tools[END_RENAME_FILES_TASK],
      [BEGIN_RECOGNIZE_TASK]: tools[BEGIN_RECOGNIZE_TASK],
      [ADD_RECOGNIZED_MEDIA_FILE]: tools[ADD_RECOGNIZED_MEDIA_FILE],
      [END_RECOGNIZE_TASK]: tools[END_RECOGNIZE_TASK],
    },
    stopWhen: stepCountIs(CHAT_STEP_LIMIT),
  });

  if (request.signal?.aborted) {
    log?.info({}, "doChat: request aborted before response creation");
    throw new Error("Request aborted");
  }

  log?.debug({}, "doChat: streaming response created");
  return result.toUIMessageStreamResponse();
}

/**
 * Validate the chat request, resolve the AI provider, and short-
 * circuit on the common "no AI selected" / "aborted" cases. Returns
 * either an early `Response` to return as-is, or the validated
 * `userConfig` + `body` to drive the streaming branch.
 */
async function prepareChat(
  config: ChatConfig,
  request: Request,
  _fs: ChatFs,
): Promise<ChatRequestOutcome> {
  const log = config.logger;

  if (request.signal?.aborted) {
    log?.info({}, "doChat: request was already aborted");
    return {
      kind: "respond",
      response: jsonResponse(499, { error: "Request was aborted" }),
    };
  }

  let userConfig: import("@smm/core/types").UserConfig;
  try {
    userConfig = await config.getUserConfig();
  } catch (error) {
    log?.error({ error: serializeError(error) }, "doChat: getUserConfig failed");
    return {
      kind: "respond",
      response: jsonResponse(500, {
        error: "Failed to read user config",
        details: error instanceof Error ? error.message : String(error),
      }),
    };
  }

  if (!userConfig.selectedAIProvider) {
    log?.debug(
      { selectedAIProvider: userConfig.selectedAIProvider },
      "doChat: no AI provider selected",
    );
    return {
      kind: "respond",
      response: jsonResponse(400, { error: "No AI selected" }),
    };
  }

  // Resolve the OpenAI-compatible provider. Errors here mean
  // configuration problems (missing API key, missing model) — the
  // caller should see a 400. The resolved result is passed through
  // to {@link doChat} so it does not need to call
  // `config.createAIProvider` a second time.
  let providerResult: { provider: unknown; model: string };
  try {
    providerResult = await config.createAIProvider(userConfig);
  } catch (error) {
    log?.error(
      { error: serializeError(error) },
      "doChat: failed to create AI provider",
    );
    return {
      kind: "respond",
      response: jsonResponse(
        400,
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create AI provider",
        },
      ),
    };
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch (error) {
    log?.error(
      { error: serializeError(error) },
      "doChat: invalid JSON body",
    );
    return {
      kind: "respond",
      response: jsonResponse(400, {
        error: "Invalid JSON body",
        details:
          error instanceof Error ? error.message : String(error),
      }),
    };
  }

  return { kind: "stream", userConfig, body, providerResult };
}

/**
 * `node:http` handler for `POST /api/chat`. Mounted automatically by
 * {@link registerCoreRoutes} when `config.chat` is present.
 */
export function handleChatPost(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
): Promise<boolean> {
  if (req.method !== "POST" || ctx.url.pathname !== "/api/chat") {
    return Promise.resolve(false);
  }
  if (!ctx.config.chat) {
    sendJson(res, 503, { error: "chat not configured" });
    return Promise.resolve(true);
  }

  return runNodeChat(ctx.config.chat, req, res);
}

async function runNodeChat(
  chatConfig: ChatConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  // Build a Web `Request` from the node:http inputs. We need the
  // web-standard `Request` because `doChat` was designed to be
  // framework-agnostic.
  const webRequest = await nodeRequestToWebRequest(req);

  let response: Response;
  try {
    response = await doChat(chatConfig, webRequest);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.message === "Request aborted")
    ) {
      sendJson(res, 499, { error: "Request was aborted" });
      return true;
    }
    chatConfig.logger?.error(
      { error: serializeError(error) },
      "doChat: handler caught error",
    );
    sendJson(res, 500, {
      error: "Failed to process chat request",
      details: error instanceof Error ? error.message : String(error),
    });
    return true;
  }

  await forwardWebResponseToNode(response, res);
  return true;
}

// ─── Internal helpers ────────────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack, name: error.name };
  }
  return { value: String(error) };
}

async function nodeRequestToWebRequest(req: IncomingMessage): Promise<Request> {
  const protocol = "http";
  const host = req.headers.host ?? "127.0.0.1:0";
  const url = `${protocol}://${host}${req.url ?? "/"}`;

  // Copy headers — the `Headers` constructor accepts the node-style
  // header bag.
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, String(value));
    }
  }

  // Body is only present for POST/PUT/PATCH. `IncomingMessage` is
  // already a `ReadableStream`-compatible async iterable, so we pass
  // it directly to the `Request` constructor.
  const init: RequestInit = { method: req.method, headers };
  if (req.method && !["GET", "HEAD"].includes(req.method.toUpperCase())) {
    init.body = req as unknown as RequestInit["body"];
    // `duplex: "half"` is required by the Node `fetch` implementation
    // when streaming a request body that may not have a known length.
    (init as RequestInit & { duplex?: "half" | "full" }).duplex = "half";
  }

  return new Request(url, init);
}

async function forwardWebResponseToNode(
  response: Response,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    // `setHeader` is a no-op when called after headers are sent, but
    // we always set headers before the first write.
    res.setHeader(key, value);
  });

  if (response.body) {
    const reader = response.body.getReader();
    // Write in chunks. `serverResponse.write` is async; we only await
    // the initial `writeHead` and let subsequent chunks flow.
    res.flushHeaders?.();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const ok = res.write(value);
      if (!ok) {
        await new Promise<void>((resolve) => res.once("drain", resolve));
      }
    }
  }
  res.end();
}
