import type {
  GetUserConfigResponseBody,
  PatchUserConfigResponseBody,
  UserConfig,
  UserConfigPatchOperation,
} from "@smm/types";
import { apiFetch } from "@/lib/apiFetch";

export async function fetchUserConfig(): Promise<UserConfig> {
  const resp = await apiFetch("/api/getUserConfig", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`);
  }
  const body = (await resp.json()) as GetUserConfigResponseBody;
  if (body.error || !body.data) {
    throw new Error(body.error ?? "Failed to read user config");
  }
  return body.data;
}

export async function patchUserConfigRequest(
  patch: UserConfigPatchOperation[],
  traceId?: string,
): Promise<UserConfig> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (traceId) {
    headers["X-Trace-Id"] = traceId;
  }
  const resp = await apiFetch("/api/patchUserConfig", {
    method: "POST",
    headers,
    body: JSON.stringify({ patch }),
  });
  const body = (await resp.json()) as PatchUserConfigResponseBody;
  if (body.error || !body.data) {
    throw new Error(body.error ?? "Failed to patch user config");
  }
  if (!resp.ok) {
    throw new Error(body.error ?? `Failed to patch user config: ${resp.statusText}`);
  }
  return body.data;
}
