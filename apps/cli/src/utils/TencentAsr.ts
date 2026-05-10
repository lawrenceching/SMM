import fs from "fs";
import { logger } from "../../lib/logger";

const log = logger.child({ module: "tencent-asr" });

export interface TencentAsrTranscribeResult {
  success?: boolean;
  error?: string;
}

/**
 * Calls a user-configured HTTP endpoint with multipart audio from `mediaPath`.
 * Contract: POST `baseUrl` with `Authorization: Bearer <apiKey>` and form field `file` (audio/video bytes).
 * Suitable for a small proxy or gateway; Tencent Cloud official APIs often need signing instead.
 */
export async function transcribeWithTencentAsrHttp(params: {
  mediaPath: string;
  baseUrl: string;
  apiKey: string;
}): Promise<TencentAsrTranscribeResult> {
  const { mediaPath, baseUrl, apiKey } = params;
  if (!mediaPath?.trim()) {
    return { error: "mediaPath is required" };
  }
  if (!fs.existsSync(mediaPath)) {
    return { error: `file not found: ${mediaPath}` };
  }
  let parsed: URL;
  try {
    parsed = new URL(baseUrl.trim());
  } catch {
    return { error: "invalid baseUrl" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "baseUrl must be http or https" };
  }
  if (!apiKey.trim()) {
    return { error: "apiKey is required" };
  }

  try {
    const fileBuffer = await fs.promises.readFile(mediaPath);
    const fileName = mediaPath.split(/[/\\]/).pop() || "audio";
    const blob = new Blob([fileBuffer]);
    const form = new FormData();
    form.append("file", blob, fileName);

    const res = await fetch(parsed.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: form,
    });

    if (res.ok) {
      return { success: true };
    }
    const text = await res.text().catch(() => "");
    const suffix = text ? `: ${text.slice(0, 500)}` : "";
    log.warn({ status: res.status, baseUrl: parsed.origin }, "Tencent ASR HTTP error response");
    return { error: `Tencent ASR request failed (${res.status})${suffix}` };
  } catch (error) {
    log.error({ error }, "Tencent ASR request threw");
    return {
      error: `Tencent ASR request failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}
