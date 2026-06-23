import { apiFetch } from '@/lib/apiFetch';
export interface TencentAsrTranscribeRequest {
  mediaPath: string
  baseUrl: string
  apiKey: string
}

export interface TencentAsrTranscribeResponse {
  success?: boolean
  error?: string
}

export async function transcribeWithTencentAsr(
  request: TencentAsrTranscribeRequest,
): Promise<TencentAsrTranscribeResponse> {
  const resp = await apiFetch("/api/tencent-asr/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mediaPath: request.mediaPath,
      baseUrl: request.baseUrl,
      apiKey: request.apiKey,
    }),
  })
  return (await resp.json()) as TencentAsrTranscribeResponse
}
